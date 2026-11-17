// Layer depths are stable (DECISIONS 11-15): a tile keeps its number through a split and a merge, so
// trashing a tile and bringing it back puts every layer where it was.

import { describe, expect, it } from "vitest";

import { layersAfter, settleDepths } from "./layer-depths";
import { layerRanks, reorderTarget } from "./layers";
import { depthsOf, fieldsOf, rowAt, serve } from "./test-layers";

const object = (m: Map<string, number>) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));

describe("trash and bring back", () => {
  // r0 is in front of everything; r2 and r3 share column 0; r1 sits right of that.
  const start = [rowAt("r0", 0, 3, 0), rowAt("r2", 0, 1, 1), rowAt("r3", 0, 1, 2), rowAt("r1", 1, 3, 3)];

  it("the exact sequence: every layer is back where it was, so the next Undo still sits", () => {
    const edited = serve(start, { kind: "update", id: "r3", version: 1, fields: { ...fieldsOf(start[2]), pieceCount: 5 } });
    expect(depthsOf(edited)).toEqual({ r0: 0, r2: 1, r3: 2, r1: 3 });
    const removed = serve(edited, { kind: "remove", id: "r0", version: 1 });
    // Nothing renumbers when r0 goes: the two parts keep their numbers.
    expect(depthsOf(removed)).toEqual({ r2: 1, r3: 2, r1: 3 });
    const back = serve(removed, { kind: "add", productId: "p-r0", fields: fieldsOf(start[0]) }, "r0b");
    expect(depthsOf(back)).toEqual({ r0b: 0, r2: 1, r3: 2, r1: 3 });
  });

  it("a tile in front of the removed one stays in front after it comes back", () => {
    // A (cols 4-5) is in front of r0 (cols 1-4), which is in front of B (cols 0-1) and C (col 0).
    const rows = [rowAt("A", 4, 2, 0), rowAt("r0", 1, 4, 1), rowAt("B", 0, 2, 2), rowAt("C", 0, 1, 3)];
    const removed = serve(rows, { kind: "remove", id: "r0", version: 1 });
    const back = serve(removed, { kind: "add", productId: "p-r0", fields: fieldsOf(rows[1]) }, "r0b");
    expect(depthsOf(back)).toEqual({ A: 0, r0b: 1, B: 2, C: 3 });
    const ranks = layerRanks(back);
    expect(ranks.get("A")).toBeLessThan(ranks.get("r0b")!);
    expect(ranks.get("r0b")).toBeLessThan(ranks.get("B")!);
  });
});

describe("settleDepths keeps numbers and only breaks ties", () => {
  it("keeps each part's depths when a group splits", () => {
    expect(object(settleDepths([rowAt("a", 0, 4, 0), rowAt("b", 10, 4, 1), rowAt("c", 12, 4, 2)]))).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("breaks a tie where two groups merge, behind the one at the left", () => {
    expect(object(settleDepths([rowAt("a", 0, 4, 0), rowAt("b", 2, 4, 1), rowAt("c", 4, 4, 0), rowAt("d", 6, 4, 1)]))).toEqual({ a: 0, b: 2, c: 1, d: 3 });
  });

  it("an asked depth a tile holds takes its place, the group's numbers dealt out again; a free one is taken as it is", () => {
    const rows = [rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 5), rowAt("c", 0, 4, 9)];
    expect(object(settleDepths(rows, { id: "c", asked: 5, before: rows[2] }))).toEqual({ a: 0, b: 9, c: 5 });
    expect(object(settleDepths(rows, { id: "a", asked: 5, before: rows[0] }))).toEqual({ a: 5, b: 0, c: 9 });
    expect(object(settleDepths(rows, { id: "c", asked: 7, before: rows[2] }))).toEqual({ a: 0, b: 5, c: 7 });
  });

  it("undoing a reorder deals the numbers back exactly", () => {
    const rows = [rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 5), rowAt("c", 0, 4, 9)];
    const forward = rows.map((r) => ({ ...r, depth: settleDepths(rows, { id: "c", asked: 5, before: rows[2] }).get(r.id)! }));
    const back = settleDepths(forward, { id: "c", asked: 9, before: forward[2] });
    expect(object(back)).toEqual({ a: 0, b: 5, c: 9 });
  });

  it("a number past 98 renumbers everything at once, keeping the order and the ties between groups", () => {
    const rows = [rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 97), rowAt("c", 0, 4, 98), rowAt("far", 20, 2, 97)];
    const added = { id: "x", before: null, asked: undefined };
    const next = [...rows, rowAt("x", 0, 4, 0)];
    expect(object(settleDepths(next, added))).toEqual({ a: 0, b: 1, c: 2, far: 1, x: 3 });
  });
});

describe("reorderTarget answers with the neighbour's depth", () => {
  it("is a depth number, not a place in the group", () => {
    const rows = [rowAt("a", 0, 4, 2), rowAt("b", 0, 4, 5), rowAt("c", 0, 4, 9)];
    expect(reorderTarget(rows[1], rows, "forward")).toBe(2);
    expect(reorderTarget(rows[1], rows, "back")).toBe(9);
    expect(reorderTarget(rows[0], rows, "forward")).toBeNull();
  });

  it("layersAfter writes only the rows whose number moves", () => {
    const rows = [rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 5), rowAt("c", 0, 4, 9)];
    expect(layersAfter(rows, { kind: "remove", id: "b", version: 1 })).toEqual({ depth: 0, others: [] });
  });
});

describe("a reorder deals out only its own group's numbers (0.7.0.5 task 2 review)", () => {
  it("tiles in other groups on the face keep their numbers, so nothing extra is written", () => {
    // Two groups; this group's numbers (5, 6) sit above the other's (0, 3), so dealing the face's numbers would move them.
    const rows = [rowAt("a", 0, 4, 5), rowAt("b", 0, 4, 6), rowAt("c", 10, 4, 0), rowAt("d", 10, 4, 3)];
    const change = { kind: "update" as const, id: "b", version: 1, fields: { ...fieldsOf(rows[1]), depth: 5 } };
    expect(layersAfter(rows, change)).toEqual({ depth: 5, others: [["a", 6]] });
    // Dealing back is exact.
    const after = serve(rows, change);
    const back = serve(after, { kind: "update", id: "b", version: 2, fields: { ...fieldsOf(after[1]), depth: 6 } });
    expect(depthsOf(back)).toEqual(depthsOf(rows));
  });
});

describe("the tidy-up past 98 ranks per face (0.7.0.5 task 2 review)", () => {
  it("renumbers only the face that went past 98; another face keeps its numbers", () => {
    const rows = [rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 98), rowAt("g1", 0, 4, 50, { faceId: "g" }), rowAt("g2", 10, 4, 60, { faceId: "g" })];
    const added = { id: "x", before: null, asked: undefined };
    const next = [...rows, rowAt("x", 0, 4, 0)];
    expect(object(settleDepths(next, added))).toEqual({ a: 0, b: 1, x: 2, g1: 50, g2: 60 });
  });

  it("with more than 99 distinct numbers on a face, tiles that overlap still keep their order, no ties", () => {
    // 99 tiles alone (numbers 0-98) and one overlapping pair past them (99, 100): 101 numbers on the face.
    const lone = Array.from({ length: 99 }, (_, i) => rowAt(`l${i}`, i * 2, 1, i));
    const rows = [...lone, rowAt("p", 300, 4, 99), rowAt("q", 300, 4, 100)];
    const depths = settleDepths(rows);
    expect(depths.get("p")).toBeLessThan(depths.get("q")!);
    expect(Math.max(...depths.values())).toBeLessThanOrEqual(98);
  });
});
