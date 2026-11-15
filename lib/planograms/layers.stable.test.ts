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
