import { describe, expect, it } from "vitest";

import { behindWords, inFrontOf, layerGroups, layerNumber, layerOffset, layerWords, paintOrder, reorderTarget, settleDepths, sharesSpace, type LayerRow } from "./layers";

const hung = (id: string, col: number, colSpan: number, depth = 0, faceId = "f1"): LayerRow => ({ id, faceId, presentation: "hung", col, row: 0, colSpan, rowSpan: 1, depth });
const folded = (id: string, col: number, colSpan: number): LayerRow => ({ ...hung(id, col, colSpan), presentation: "folded" });
const asObject = (m: Map<string, number>) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));

describe("sharesSpace", () => {
  it("is true only for two hung on one face that overlap", () => {
    expect(sharesSpace(hung("a", 0, 4), hung("b", 2, 4))).toBe(true);
    expect(sharesSpace(hung("a", 0, 4), hung("b", 4, 4))).toBe(false);
    expect(sharesSpace(hung("a", 0, 4), hung("b", 0, 4, 0, "f2"))).toBe(false);
    expect(sharesSpace(hung("a", 0, 4), folded("b", 0, 4))).toBe(false);
    expect(sharesSpace(hung("a", 0, 4), hung("a", 0, 4))).toBe(false);
  });
});

describe("layerGroups", () => {
  it("joins placements through overlaps, front to back", () => {
    const groups = layerGroups([hung("c", 6, 4, 0), hung("a", 0, 4, 1), hung("b", 3, 4, 0), hung("d", 20, 2)]);
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([["b", "c", "a"], ["d"]]);
  });
});

describe("settleDepths", () => {
  it("puts a product that joins at the back", () => {
    const rows = [hung("a", 0, 4, 0), hung("b", 4, 4, 1), hung("x", 2, 4, 0)];
    // a and b were apart; x was elsewhere and now bridges them.
    const depths = settleDepths(rows, { id: "x", before: hung("x", 20, 4) });
    expect(asObject(depths)).toEqual({ a: 0, b: 1, x: 2 });
  });

  it("keeps a moved product's place while it overlaps nothing new", () => {
    const rows = [hung("a", 1, 4, 0), hung("b", 0, 4, 1)];
    expect(asObject(settleDepths(rows, { id: "a", before: hung("a", 0, 4) }))).toEqual({ a: 0, b: 1 });
  });

  it("honours the place asked for (a reorder or an undo)", () => {
    const rows = [hung("a", 0, 4, 0), hung("b", 0, 4, 1), hung("c", 0, 4, 2)];
    expect(asObject(settleDepths(rows, { id: "c", asked: 0, before: rows[2] }))).toEqual({ a: 1, b: 2, c: 0 });
    expect(asObject(settleDepths(rows, { id: "a", asked: 9, before: rows[0] }))).toEqual({ a: 2, b: 0, c: 1 });
  });

  it("renumbers each part when a group splits", () => {
    const rows = [hung("a", 0, 4, 0), hung("b", 10, 4, 1), hung("c", 12, 4, 2)];
    expect(asObject(settleDepths(rows))).toEqual({ a: 0, b: 0, c: 1 });
  });

  it("orders merged groups by depth, then left edge", () => {
    const rows = [hung("a", 0, 4, 0), hung("b", 2, 4, 1), hung("c", 4, 4, 0)];
    expect(asObject(settleDepths(rows))).toEqual({ a: 0, b: 2, c: 1 });
  });

  it("leaves folded product and loners at 0", () => {
    expect(asObject(settleDepths([folded("f", 0, 4), hung("h", 10, 2, 3)]))).toEqual({ f: 0, h: 0 });
  });
});

describe("layer words and drawing", () => {
  const rows = [hung("front", 0, 4, 0), hung("mid", 1, 4, 1), hung("back", 2, 4, 2), hung("apart", 20, 2)];

  it("numbers by what overlaps it from in front", () => {
    expect(layerNumber(rows[0], rows)).toBe(1);
    expect(layerNumber(rows[2], rows)).toBe(3);
    expect(layerNumber(rows[3], rows)).toBeNull();
    expect(inFrontOf(rows[2], rows).map((r) => r.id)).toEqual(["mid", "front"]);
  });

  it("offsets 6 px per step, at most three", () => {
    expect(layerOffset(rows[0], rows)).toBe(0);
    expect(layerOffset(rows[2], rows)).toBe(12);
    const deep = [0, 1, 2, 3, 4].map((d) => hung(`d${d}`, 0, 4, d));
    expect(layerOffset(deep[4], deep)).toBe(18);
  });

  it("paints back to front", () => {
    expect(paintOrder(rows).map((r) => r.id).slice(0, 3)).toEqual(["back", "mid", "front"]);
  });

  it("finds the swap for Move forward and Move back", () => {
    expect(reorderTarget(rows[1], rows, "forward")).toBe(0);
    expect(reorderTarget(rows[1], rows, "back")).toBe(2);
    expect(reorderTarget(rows[0], rows, "forward")).toBeNull();
    expect(reorderTarget(rows[3], rows, "back")).toBeNull();
    // c overlaps a but not b: forward skips b.
    const gap = [hung("a", 0, 6, 0), hung("b", 6, 2, 1), hung("c", 0, 2, 2), hung("d", 4, 4, 3)];
    expect(reorderTarget(gap[2], gap, "forward")).toBe(0);
  });

  it("words the layer", () => {
    expect([1, 2, 3, 4, 11, 12, 21].map(layerWords)).toEqual(["front", "2nd from front", "3rd from front", "4th from front", "11th from front", "12th from front", "21st from front"]);
    expect(layerWords(null)).toBeNull();
    expect(behindWords([])).toBeNull();
    expect(behindWords(["Navy Tee"])).toBe("Behind Navy Tee");
    expect(behindWords(["Navy Tee", "Sand Tee"])).toBe("Behind Navy Tee and Sand Tee");
    expect(behindWords(["A", "B", "C"])).toBe("Behind A and 2 others");
  });
});
