import { describe, expect, it } from "vitest";

import { diffPlacements, goneFaces, sortByFaceOrder, summarizeChanges, type Comparable } from "./diff";
import type { PlanogramFace, SnapshotEntry } from "./types";

const c = (over: Partial<Comparable>): Comparable => ({
  faceId: "front", faceLabel: "Front", productId: "pant", productName: "High-Rise Pant", presentation: "folded",
  col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 4, ...over,
});

describe("diffPlacements", () => {
  it("finds added, removed, moved and count changes, grouped by face", () => {
    const before = [c({}), c({ productId: "tee", productName: "Pocket Tee", col: 2 }), c({ faceId: "back", faceLabel: "Back", productId: "sock" })];
    const after = [c({ row: 2 }), c({ productId: "tee", productName: "Pocket Tee", col: 2, pieceCount: 6 }), c({ productId: "cap", col: 4 })];
    const changes = diffPlacements(before, after);
    expect(changes.map((f) => [f.label, f.added.length, f.removed.length, f.moved.length, f.recounted.length])).toEqual([
      ["Front", 1, 0, 1, 1],
      ["Back", 0, 1, 0, 0],
    ]);
    expect(summarizeChanges(changes)).toBe("Front: 1 added, 1 moved, 1 count changed · Back: 1 removed");
  });

  it("pairs unmoved twins first, so one moving doesn't make both look moved", () => {
    const before = [c({}), c({ col: 4 })];
    const after = [c({ col: 4 }), c({ row: 2 })];
    expect(diffPlacements(before, after)[0].moved).toHaveLength(1);
  });

  it("says when nothing changed", () => {
    expect(diffPlacements([c({})], [c({})])).toEqual([]);
    expect(summarizeChanges([])).toBe("No changes");
  });
});

describe("goneFaces", () => {
  it("names faces of a version that the fixture no longer has", () => {
    const entry = { ...c({ faceId: "back", faceLabel: "Back" }), side: "back", fixtureId: "rack", fixtureName: "Rack", styleNumber: "S" } as SnapshotEntry;
    const faces = [{ faceId: "front" }] as PlanogramFace[];
    expect(goneFaces([entry, entry, entry], faces)).toEqual([{ label: "Back", count: 3 }]);
  });
});

describe("sortByFaceOrder", () => {
  it("orders faces by the given list, unknown faces last, without mutating", () => {
    const face = (faceId: string) => ({ faceId, label: faceId, added: [], removed: [], moved: [], recounted: [] });
    const input = [face("x"), face("back"), face("y"), face("front")];
    expect(sortByFaceOrder(input, ["front", "back"]).map((f) => f.faceId)).toEqual(["front", "back", "x", "y"]);
    expect(input.map((f) => f.faceId)).toEqual(["x", "back", "y", "front"]);
  });
});
