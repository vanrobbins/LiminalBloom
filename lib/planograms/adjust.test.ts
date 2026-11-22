import { describe, expect, it } from "vitest";

import { adjustedFloor, applyAdjustment, targetKey } from "./adjust";
import { emptying, entry, replacing } from "./test-adjust";

const a = entry({ productId: "a", productName: "A", col: 0 });
const b = entry({ productId: "b", productName: "B", col: 2 });
const rail = entry({ productId: "r1", presentation: "hung", col: 4, colSpan: 3, rowSpan: 1, depth: 2 });

describe("targetKey", () => {
  it("is the same for a snapshot entry and the change row that names it, and differs per cell, depth and product", () => {
    const renamed = { ...a, productName: "Renamed", pieceCount: 9 };
    expect(targetKey(a)).toBe(targetKey(renamed));
    const keys = new Set([a, { ...a, col: 1 }, { ...a, row: 1 }, { ...a, depth: 1 }, { ...a, faceId: "f2" }, { ...a, productId: "z" }].map(targetKey));
    expect(keys.size).toBe(6);
  });

  it("reads a missing depth as 0, as old versions do", () => {
    expect(targetKey({ ...a, depth: undefined })).toBe(targetKey({ ...a, depth: 0 }));
  });
});

describe("applyAdjustment", () => {
  it("replaces the product, its names and its span, and keeps the place, presentation, depth and pieces", () => {
    const wide = replacing(rail, "slim", { replacement: { productId: "slim", productName: "Slim jean", styleNumber: "S-9", colSpan: 2, rowSpan: 1 }, pieceCount: 5 });
    const { entries, skipped } = applyAdjustment([a, rail], [wide]);
    expect(skipped).toBe(0);
    expect(entries[0]).toEqual(a);
    expect(entries[1]).toEqual({ ...rail, productId: "slim", productName: "Slim jean", styleNumber: "S-9", colSpan: 2, rowSpan: 1, pieceCount: 5 });
  });

  it("drops an entry that is left empty and leaves the others in order", () => {
    expect(applyAdjustment([a, b, rail], [emptying(b)]).entries).toEqual([a, rail]);
  });

  it("skips a change whose target is not in the snapshot and counts it, never throwing", () => {
    const gone = entry({ productId: "gone", col: 8 });
    const result = applyAdjustment([a, b], [replacing(gone, "x"), emptying(entry({ productId: "a", col: 5 })), emptying(b)]);
    expect(result).toEqual({ entries: [a], skipped: 2 });
  });

  it("matches the target by its cells and depth, so a twin of the same product elsewhere is untouched", () => {
    const twin = { ...a, col: 6 };
    expect(applyAdjustment([a, twin], [emptying(a)]).entries).toEqual([twin]);
    const layered = { ...rail, depth: 5 };
    expect(applyAdjustment([rail, layered], [emptying(layered)]).entries).toEqual([rail]);
  });

  it("does not change the snapshot it is given", () => {
    const snapshot = [a, b];
    const before = structuredClone(snapshot);
    applyAdjustment(snapshot, [replacing(a, "x"), emptying(b)]);
    expect(snapshot).toEqual(before);
  });

  it("with no changes returns the snapshot's entries", () => {
    expect(applyAdjustment([a, b], [])).toEqual({ entries: [a, b], skipped: 0 });
  });
});

describe("adjustedFloor", () => {
  it("is the latest version with the published adjustment applied", () => {
    expect(adjustedFloor({ number: 3, placements: [a, b] }, [emptying(a)])).toEqual([b]);
  });

  it("is the version itself with no adjustment, and nothing without a version", () => {
    expect(adjustedFloor({ number: 3, placements: [a, b] }, null)).toEqual([a, b]);
    expect(adjustedFloor({ number: 3, placements: [a, b] }, [])).toEqual([a, b]);
    expect(adjustedFloor(null, [emptying(a)])).toEqual([]);
  });
});
