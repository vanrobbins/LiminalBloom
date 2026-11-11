// Who may use the map editor's actions (spec 0.7 §4.7): both need layout.edit, and a
// refused save writes nothing. The writes are stood in for.

import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  applyLayoutChanges: vi.fn(async () => ({ status: "saved", layout: { fixtures: [] } })),
  loadLayout: vi.fn(async () => ({ fixtures: [] })),
}));
vi.mock("@/lib/current-member");
vi.mock("@/lib/layout/save", () => ({ applyLayoutChanges: fake.applyLayoutChanges }));
vi.mock("@/lib/layout/load", () => ({ loadLayout: fake.loadLayout }));

import type { Switch } from "@/lib/access/switches";
import { guardFor, memberWith } from "@/lib/access/test-guard";
import * as currentMember from "@/lib/current-member";

import { fetchLayout, saveLayoutChanges } from "./actions";

let who = memberWith("store_a", ["view"]);
const as = (...switches: Switch[]) => {
  who = memberWith("store_a", ["view", ...switches]);
};
beforeEach(() => {
  vi.clearAllMocks();
  as();
  vi.mocked(currentMember.getCurrentMember).mockImplementation(async () => who);
  vi.mocked(currentMember.requireSwitchForAction).mockImplementation(guardFor(() => who));
});

const empty = { outline: null, entrances: [], zones: [], fixtures: [], faces: [], tableSets: [], frameRuns: [], deletes: [] };

describe("layout editor actions need layout.edit", () => {
  it("saveLayoutChanges", async () => {
    expect(await saveLayoutChanges("store_a", empty)).toEqual({ status: "forbidden" });
    expect(fake.applyLayoutChanges).not.toHaveBeenCalled();
    expect(fake.loadLayout).not.toHaveBeenCalled();
    as("layout.edit");
    expect(await saveLayoutChanges("store_a", empty)).toMatchObject({ status: "saved" });
    expect(fake.applyLayoutChanges).toHaveBeenCalledTimes(1);
  });

  it("fetchLayout", async () => {
    expect(await fetchLayout("store_a")).toEqual({ status: "forbidden" });
    expect(fake.loadLayout).not.toHaveBeenCalled();
    as("layout.edit");
    expect(await fetchLayout("store_a")).toEqual({ status: "ok", layout: { fixtures: [] } });
  });

  it("still tells a signed-out editor so, so it can say its last change was not saved", async () => {
    vi.mocked(currentMember.getCurrentMember).mockResolvedValue({ kind: "signed-out" });
    expect(await saveLayoutChanges("store_a", empty)).toEqual({ status: "signed-out" });
    expect(await fetchLayout("store_a")).toEqual({ status: "signed-out" });
  });
});
