// Who may use the Quick Adjust actions (0.7.0.9 spec §3, §6.3): open, change, suggestions and discard need
// planograms.draft; publish and revert need planograms.publish; Compare needs view. Each is refused without its
// switch and reads or writes nothing, and goes through with it. The writes are stood in for.

import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const draft = { id: "adj", version: 2, changes: [] };
  return {
    draft,
    openAdjustment: vi.fn(async () => ({ status: "saved", draft })),
    setChange: vi.fn(async () => ({ status: "saved" })),
    discardAdjustment: vi.fn(async () => ({ status: "saved" })),
    publishAdjustment: vi.fn(async () => ({ status: "saved" })),
    revertAdjustment: vi.fn(async () => ({ status: "saved" })),
    draftOf: vi.fn(async () => draft),
    suggestionsFor: vi.fn(async () => [{ productId: "p" }]),
    previewAdjustment: vi.fn(async () => ({ kind: "draft" })),
  };
});
vi.mock("@/lib/current-member");
vi.mock("@/lib/planograms/adjust-write", () => ({ openAdjustment: fake.openAdjustment, setChange: fake.setChange, discardAdjustment: fake.discardAdjustment }));
vi.mock("@/lib/planograms/adjust-publish", () => ({ publishAdjustment: fake.publishAdjustment, revertAdjustment: fake.revertAdjustment }));
vi.mock("@/lib/planograms/adjust-reads", () => ({ draftOf: fake.draftOf, suggestionsFor: fake.suggestionsFor, previewAdjustment: fake.previewAdjustment }));

import type { Switch } from "@/lib/access/switches";
import { guardFor, memberWith } from "@/lib/access/test-guard";
import * as currentMember from "@/lib/current-member";

import {
  discardAdjustmentAction,
  openAdjustmentAction,
  previewAdjustmentAction,
  publishAdjustmentAction,
  revertAdjustmentAction,
  setChangeAction,
  suggestionsForAction,
} from "./adjust-actions";

let who = memberWith("store_a", []);
const as = (...switches: Switch[]) => {
  who = memberWith("store_a", switches);
};
beforeEach(() => {
  vi.clearAllMocks();
  as();
  vi.mocked(currentMember.requireSwitchForAction).mockImplementation(guardFor(() => who));
});

const writers = [fake.openAdjustment, fake.setChange, fake.discardAdjustment, fake.publishAdjustment, fake.revertAdjustment];
const nothingWritten = () => {
  for (const write of writers) expect(write).not.toHaveBeenCalled();
};

const f = randomUUID();
const adj = randomUUID();
const target = { faceId: randomUUID(), productId: randomUUID(), col: 0, row: 0, depth: 0 };
const replace = { kind: "replace", productId: randomUUID() };
const DRAFT = "Your role can't change Quick Adjusts.";
const PUBLISH = "Your role can't publish Quick Adjusts.";

describe("planograms.draft", () => {
  it("openAdjustmentAction", async () => {
    expect(await openAdjustmentAction(f)).toEqual({ status: "forbidden", message: DRAFT, draft: null });
    nothingWritten();
    as("planograms.draft");
    expect(await openAdjustmentAction(f)).toEqual({ status: "saved", draft: fake.draft });
    expect(fake.openAdjustment).toHaveBeenCalledWith("store_a", f, "Test User");
  });

  it("setChangeAction hands back the whole draft, and passes the tile's own version", async () => {
    expect(await setChangeAction(f, adj, target, replace, null)).toEqual({ status: "forbidden", message: DRAFT, draft: null });
    nothingWritten();
    as("planograms.draft");
    expect(await setChangeAction(f, adj, target, replace, 3)).toEqual({ status: "saved", draft: fake.draft });
    expect(fake.setChange).toHaveBeenCalledWith("store_a", f, adj, target, replace, 3);
  });

  it("setChangeAction refuses a bad tile, choice or version without writing", async () => {
    as("planograms.draft");
    for (const bad of [
      () => setChangeAction("nope", adj, target, replace, null),
      () => setChangeAction(f, adj, { ...target, col: -1 }, replace, null),
      () => setChangeAction(f, adj, target, { kind: "swap" }, null),
      () => setChangeAction(f, adj, target, replace, 0),
    ]) {
      expect(await bad()).toMatchObject({ status: "refused", draft: null });
    }
    nothingWritten();
  });

  it("setChangeAction says why it was refused, and still returns the draft", async () => {
    as("planograms.draft");
    fake.setChange.mockResolvedValueOnce({ status: "conflict" } as never);
    expect(await setChangeAction(f, adj, target, replace, null)).toEqual({ status: "refused", message: "Changed on another device", draft: fake.draft });
    fake.setChange.mockResolvedValueOnce({ status: "invalid", message: "Slim jean is sold out." } as never);
    expect(await setChangeAction(f, adj, target, replace, null)).toMatchObject({ status: "refused", message: "Slim jean is sold out." });
  });

  it("suggestionsForAction reads nothing without the switch", async () => {
    expect(await suggestionsForAction(f, target)).toEqual([]);
    expect(fake.suggestionsFor).not.toHaveBeenCalled();
    as("planograms.draft");
    expect(await suggestionsForAction(f, target)).toEqual([{ productId: "p" }]);
  });

  it("discardAdjustmentAction", async () => {
    expect(await discardAdjustmentAction(f, adj, 2)).toEqual({ status: "forbidden", message: DRAFT });
    nothingWritten();
    as("planograms.draft");
    expect(await discardAdjustmentAction(f, adj, 2)).toEqual({ status: "saved", message: "Quick Adjust discarded" });
  });

  it("is not publishing: a drafter can't publish or revert", async () => {
    as("planograms.draft");
    expect(await publishAdjustmentAction(f, adj, 2)).toEqual({ status: "forbidden", message: PUBLISH });
    expect(await revertAdjustmentAction(f, adj)).toEqual({ status: "forbidden", message: PUBLISH });
    nothingWritten();
  });
});

describe("planograms.publish", () => {
  it("publishAdjustmentAction says what happened in words", async () => {
    expect(await publishAdjustmentAction(f, adj, 2)).toEqual({ status: "forbidden", message: PUBLISH });
    nothingWritten();
    as("planograms.publish");
    expect(await publishAdjustmentAction(f, adj, 2)).toEqual({ status: "saved", message: "Quick Adjust published" });
    fake.publishAdjustment.mockResolvedValueOnce({ status: "published-elsewhere", number: 4 } as never);
    expect(await publishAdjustmentAction(f, adj, 2)).toEqual({ status: "refused", message: "Version 4 was published meanwhile. This Quick Adjust ended with it." });
    fake.publishAdjustment.mockResolvedValueOnce({ status: "draft-changed" } as never);
    expect(await publishAdjustmentAction(f, adj, 2)).toEqual({ status: "refused", message: "Changed on another device. Look again before publishing." });
  });

  it("revertAdjustmentAction", async () => {
    expect(await revertAdjustmentAction(f, adj)).toEqual({ status: "forbidden", message: PUBLISH });
    nothingWritten();
    as("planograms.publish");
    expect(await revertAdjustmentAction(f, adj)).toEqual({ status: "saved", message: "Quick Adjust reverted" });
    fake.revertAdjustment.mockResolvedValueOnce({ status: "conflict" } as never);
    expect(await revertAdjustmentAction(f, adj)).toMatchObject({ status: "refused" });
  });

  it("is not drafting: a publisher can't open, change or discard", async () => {
    as("planograms.publish");
    expect(await openAdjustmentAction(f)).toMatchObject({ status: "forbidden" });
    expect(await setChangeAction(f, adj, target, replace, null)).toMatchObject({ status: "forbidden" });
    expect(await discardAdjustmentAction(f, adj, 2)).toMatchObject({ status: "forbidden" });
    nothingWritten();
  });
});

describe("view", () => {
  it("previewAdjustmentAction is for anyone who can see, and nobody else", async () => {
    expect(await previewAdjustmentAction(f)).toBeNull();
    expect(fake.previewAdjustment).not.toHaveBeenCalled();
    as("view");
    expect(await previewAdjustmentAction(f)).toEqual({ kind: "draft" });
    expect(await previewAdjustmentAction("nope")).toBeNull();
  });
});
