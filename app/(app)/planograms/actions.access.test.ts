// Who may use the planogram actions (spec 0.7 §4.7): begin draft, save a change, reload,
// discard and the add form's search need planograms.draft; publish, its preview, restore and
// the due date need planograms.publish. Each is refused without its switch and writes
// nothing, and goes through with it. The writes are stood in for.

import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const draft = { planogramVersion: 1, placements: [] };
  return {
    draft,
    startDraft: vi.fn(async () => ({ status: "saved" })),
    saveChange: vi.fn(async () => ({ status: "saved" })),
    discardDraft: vi.fn(async () => ({ status: "saved" })),
    setDueDate: vi.fn(async () => ({ status: "saved" })),
    publishDraft: vi.fn(async () => ({ status: "saved", number: 2 })),
    restoreVersion: vi.fn(async () => ({ status: "saved", skipped: [] })),
    previewPublish: vi.fn(async () => ({ isEmpty: false })),
    draftState: vi.fn(async () => draft),
    productFits: vi.fn(async () => new Map()),
    searchProducts: vi.fn(async () => []),
  };
});
vi.mock("@/lib/current-member");
vi.mock("@/lib/planograms/write", () => ({ startDraft: fake.startDraft, saveChange: fake.saveChange, discardDraft: fake.discardDraft, setDueDate: fake.setDueDate }));
vi.mock("@/lib/planograms/publish", () => ({ publishDraft: fake.publishDraft, restoreVersion: fake.restoreVersion, previewPublish: fake.previewPublish }));
vi.mock("@/lib/planograms/queries", () => ({ draftState: fake.draftState }));
vi.mock("@/lib/planograms/draft-sources", () => ({ productFits: fake.productFits }));
vi.mock("@/lib/products/queries", () => ({ searchProducts: fake.searchProducts }));

import type { Switch } from "@/lib/access/switches";
import { guardFor, memberWith } from "@/lib/access/test-guard";
import * as currentMember from "@/lib/current-member";

import {
  beginDraftAction,
  discardDraftAction,
  pickerSearch,
  previewPublishAction,
  publishAction,
  reloadDraftAction,
  restoreAction,
  saveChangeAction,
  setDueDateAction,
  startDraftAction,
} from "./actions";

let who = memberWith("store_a", ["view"]);
const as = (...switches: Switch[]) => {
  who = memberWith("store_a", ["view", ...switches]);
};
beforeEach(() => {
  vi.clearAllMocks();
  as();
  vi.mocked(currentMember.requireSwitchForAction).mockImplementation(guardFor(() => who));
});

const writers = [fake.startDraft, fake.saveChange, fake.discardDraft, fake.setDueDate, fake.publishDraft, fake.restoreVersion];
const nothingWritten = () => {
  for (const write of writers) expect(write).not.toHaveBeenCalled();
};

const f = randomUUID();
const product = randomUUID();
const change = { kind: "add", productId: product, fields: { faceId: randomUUID(), presentation: "hung", col: 0, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 1 } };
const DRAFT = "Your role can't change planogram drafts.";
const PUBLISH = "Your role can't publish planograms.";

describe("planograms.draft", () => {
  it("startDraftAction", async () => {
    expect(await startDraftAction(f, null)).toEqual({ status: "forbidden", message: DRAFT });
    nothingWritten();
    as("planograms.draft");
    expect(await startDraftAction(f, null)).toEqual({ status: "saved", message: "Draft started" });
  });

  it("beginDraftAction", async () => {
    expect(await beginDraftAction(f, null)).toEqual({ status: "forbidden", message: DRAFT, draft: null });
    nothingWritten();
    as("planograms.draft");
    expect(await beginDraftAction(f, null)).toMatchObject({ status: "saved" });
  });

  it("saveChangeAction", async () => {
    expect(await saveChangeAction(f, change)).toEqual({ status: "forbidden", message: DRAFT, draft: null });
    nothingWritten();
    as("planograms.draft");
    expect(await saveChangeAction(f, change)).toMatchObject({ status: "saved" });
  });

  it("saveChangeAction hands back the id an add was written under", async () => {
    as("planograms.draft");
    fake.saveChange.mockResolvedValueOnce({ status: "saved", id: "new-id" } as never);
    expect(await saveChangeAction(f, change)).toEqual({ status: "saved", draft: fake.draft, id: "new-id" });
  });

  it("reloadDraftAction reads nothing without the switch", async () => {
    expect(await reloadDraftAction(f)).toBeNull();
    expect(fake.draftState).not.toHaveBeenCalled();
    as("planograms.draft");
    expect(await reloadDraftAction(f)).toBe(fake.draft);
  });

  it("discardDraftAction", async () => {
    expect(await discardDraftAction(f, 1)).toEqual({ status: "forbidden", message: DRAFT });
    nothingWritten();
    as("planograms.draft");
    expect(await discardDraftAction(f, 1)).toEqual({ status: "saved", message: "Draft discarded" });
  });

  it("pickerSearch searches nothing without the switch", async () => {
    expect(await pickerSearch("tee")).toEqual([]);
    expect(fake.searchProducts).not.toHaveBeenCalled();
    as("planograms.draft");
    await pickerSearch("tee");
    expect(fake.searchProducts).toHaveBeenCalled();
  });

  it("is not publishing: a drafter can't publish, restore or set a due date", async () => {
    as("planograms.draft");
    expect(await publishAction(f, 1, null, "")).toEqual({ status: "forbidden", message: PUBLISH });
    expect(await restoreAction(f, 1, 1)).toEqual({ status: "forbidden", message: PUBLISH });
    expect(await setDueDateAction(f, "2026-12-01")).toEqual({ status: "forbidden", message: PUBLISH });
    expect(await previewPublishAction(f)).toBeNull();
    nothingWritten();
    expect(fake.previewPublish).not.toHaveBeenCalled();
  });
});

describe("planograms.publish", () => {
  it("publishAction", async () => {
    expect(await publishAction(f, 1, null, "")).toEqual({ status: "forbidden", message: PUBLISH });
    nothingWritten();
    as("planograms.publish");
    expect(await publishAction(f, 1, null, "")).toEqual({ status: "saved", message: "Version 2 published" });
  });

  it("previewPublishAction", async () => {
    expect(await previewPublishAction(f)).toBeNull();
    expect(fake.previewPublish).not.toHaveBeenCalled();
    as("planograms.publish");
    expect(await previewPublishAction(f)).toEqual({ isEmpty: false });
  });

  it("restoreAction", async () => {
    expect(await restoreAction(f, 1, 1)).toEqual({ status: "forbidden", message: PUBLISH });
    nothingWritten();
    as("planograms.publish");
    expect(await restoreAction(f, 1, 1)).toMatchObject({ status: "saved" });
  });

  it("setDueDateAction", async () => {
    expect(await setDueDateAction(f, "2026-12-01")).toEqual({ status: "forbidden", message: PUBLISH });
    nothingWritten();
    as("planograms.publish");
    expect(await setDueDateAction(f, "2026-12-01")).toEqual({ status: "saved", message: "Due date saved" });
  });

  it("is not drafting: a publisher can't start or discard a draft", async () => {
    as("planograms.publish");
    expect(await startDraftAction(f, null)).toMatchObject({ status: "forbidden" });
    expect(await discardDraftAction(f, 1)).toMatchObject({ status: "forbidden" });
    nothingWritten();
  });
});
