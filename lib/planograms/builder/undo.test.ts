import { describe, expect, it } from "vitest";

import type { PlacementFields, PlacementView } from "../types";

import { advance, aheadOf, EMPTY_HISTORY, forget, prune, record, redo, rename, sitsAt, undo, type Step } from "./undo";

const at = (col: number): PlacementFields => ({ faceId: "f", presentation: "hung", col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1 });
const view = (id: string, col: number, version: number): PlacementView => ({
  depth: 0,
  ...at(col), id, productId: id, productName: id, styleNumber: id, imageKey: null, categoryName: "", version,
});
const moved = (id: string, from: number, to: number): Step => ({ kind: "update", id, before: at(from), after: at(to) });
const added = (id: string, col: number): Step => ({ kind: "add", id, productId: "pant", fields: at(col) });
const removed = (id: string, col: number): Step => ({ kind: "remove", id, productId: "pant", fields: at(col) });

describe("undo history", () => {
  it("undoes to the earlier fields at the placement's current version, then redoes", () => {
    const history = record(EMPTY_HISTORY, moved("a", 0, 4));
    const back = undo(history, [view("a", 4, 7)]);
    expect(back?.change).toEqual({ kind: "update", id: "a", version: 7, fields: at(0) });
    expect(back?.history).toEqual({ done: [], undone: [moved("a", 0, 4)] });
    const again = back ? redo(back.history, [view("a", 0, 8)]) : null;
    expect(again?.change).toEqual({ kind: "update", id: "a", version: 8, fields: at(4) });
  });

  it("a new change clears what could be redone", () => {
    const undone = { done: [], undone: [moved("a", 0, 4)] };
    expect(record(undone, moved("b", 2, 6))).toEqual({ done: [moved("b", 2, 6)], undone: [] });
  });

  it("has nothing to undo or redo when empty", () => {
    expect(undo(EMPTY_HISTORY, [])).toBeNull();
    expect(redo(EMPTY_HISTORY, [])).toBeNull();
  });

  it("forgets every step of a placement another device changed (Review Focus 2)", () => {
    const history = { done: [moved("a", 0, 2), moved("b", 0, 2), moved("a", 2, 4)], undone: [moved("a", 4, 6)] };
    expect(forget(history, "a")).toEqual({ done: [moved("b", 0, 2)], undone: [] });
  });

  it("drops steps whose placement is gone", () => {
    const history = { done: [moved("a", 0, 2), moved("gone", 0, 2)], undone: [moved("gone", 2, 4)] };
    expect(prune(history, [view("a", 2, 3)])).toEqual({ done: [moved("a", 0, 2)], undone: [] });
  });

  it("tells whether a placement still sits where a step left it (Review Focus 2)", () => {
    expect(sitsAt(view("a", 4, 9), at(4))).toBe(true);
    expect(sitsAt(view("a", 6, 9), at(4))).toBe(false);
    expect(sitsAt({ ...view("a", 4, 9), pieceCount: 3 }, at(4))).toBe(false);
    expect(sitsAt({ ...view("a", 4, 9), faceId: "g" }, at(4))).toBe(false);
  });

  it("notices a layer change by another device: not behind a tile it overlapped, or not in front of one", () => {
    const [a, other] = [view("a", 4, 9), { ...view("b", 4, 9), depth: 1 }];
    const behind = { front: ["b"], back: [], prev: "b" };
    expect(sitsAt({ ...a, depth: 2 }, at(4), behind, [other])).toBe(true);
    expect(sitsAt({ ...a, depth: 0 }, at(4), behind, [other])).toBe(false);
    expect(sitsAt({ ...a, depth: 0 }, at(4), { front: [], back: ["b"], prev: null }, [other])).toBe(true);
    expect(sitsAt({ ...a, depth: 2 }, at(4), { front: [], back: ["b"], prev: null }, [other])).toBe(false);
    // Numbers alone say nothing, a tile that moved away or is gone doesn't count, and a step with no anchor skips the check.
    expect(sitsAt({ ...a, depth: 7 }, at(4), behind, [{ ...other, col: 20 }])).toBe(true);
    expect(sitsAt({ ...a, depth: 0 }, at(4), behind, [])).toBe(true);
    expect(sitsAt({ ...a, depth: 0 }, at(4))).toBe(true);
  });

  it("asks for a place behind the tiles it was behind, and no depth when none is left", () => {
    const ahead = { front: ["b"], back: ["c"], prev: "b" };
    const history = record(EMPTY_HISTORY, { kind: "remove", id: "a", productId: "pant", fields: { ...at(4), depth: 5 }, ahead });
    const there = [view("b", 0, 1), view("c", 0, 1)];
    expect(undo(history, there)?.change).toEqual({ kind: "add", productId: "pant", fields: { ...at(4), depth: undefined, place: { after: "b", front: ["b"], back: ["c"] } } });
    // None left to go by: no depth either (the number may be a tile's now), so it joins as any add does.
    expect(undo(history, [])?.change).toEqual({ kind: "add", productId: "pant", fields: { ...at(4), depth: undefined } });
    // The tiles it was behind are re-pointed when one comes back under a new id.
    const renamed = rename(history, "b", "b2");
    expect(undo(renamed, [view("b2", 0, 1)])?.change).toMatchObject({ fields: { place: { after: "b2", front: ["b2"] } } });
  });

  it("finds the tiles overlapping a tile, in front and behind, and the one before it on the face", () => {
    const rows = [{ ...view("a", 0, 1), colSpan: 2, depth: 0 }, { ...view("b", 1, 1), colSpan: 2, depth: 1 }, { ...view("c", 8, 1), depth: 2 }];
    expect(aheadOf("b", rows)).toEqual({ front: ["a"], back: [], prev: "a" });
    expect(aheadOf("a", rows)).toEqual({ front: [], back: ["b"], prev: null });
    expect(aheadOf("c", rows)).toBeUndefined();
  });

  it("keeps the last 50 steps", () => {
    let history = EMPTY_HISTORY;
    for (let i = 0; i < 60; i++) history = record(history, moved(`p${i}`, 0, 1));
    expect(history.done).toHaveLength(50);
    expect(history.done[0].id).toBe("p10");
  });

  it("undoes a remove by adding the product back with its fields and layer depth, redoes it by removing", () => {
    const fields = { ...at(3), depth: 2 };
    const history = record(EMPTY_HISTORY, { kind: "remove", id: "a", productId: "pant", fields });
    const back = undo(history, []);
    expect(back?.change).toEqual({ kind: "add", productId: "pant", fields });
    expect(back?.history).toEqual({ done: [], undone: [{ kind: "remove", id: "a", productId: "pant", fields }] });
    // Back under a new id, which the caller points the steps at.
    const again = back ? redo(rename(back.history, "a", "b"), [{ ...view("b", 3, 1), depth: 2 }]) : null;
    expect(again?.change).toEqual({ kind: "remove", id: "b", version: 1 });
  });

  it("undoes an add by removing it at its current version, redoes it by adding it again", () => {
    const history = record(EMPTY_HISTORY, added("a", 1));
    const gone = undo(history, [view("a", 1, 6)]);
    expect(gone?.change).toEqual({ kind: "remove", id: "a", version: 6 });
    const again = gone ? redo(gone.history, []) : null;
    expect(again?.change).toEqual({ kind: "add", productId: "pant", fields: at(1) });
    expect(again?.history).toEqual({ done: [added("a", 1)], undone: [] });
  });

  it("can't remove a placement that isn't there, so an undone add or a redone remove with none stops", () => {
    expect(undo(record(EMPTY_HISTORY, added("a", 1)), [])).toBeNull();
    expect(redo({ done: [], undone: [removed("a", 1)] }, [])).toBeNull();
  });

  it("renames a placement's steps, in both stacks and every kind, and leaves the others alone", () => {
    const history = { done: [added("a", 0), moved("a", 0, 2), moved("b", 0, 2)], undone: [removed("a", 2), moved("a", 2, 4)] };
    expect(rename(history, "a", "c")).toEqual({
      done: [added("c", 0), moved("c", 0, 2), moved("b", 0, 2)],
      undone: [removed("c", 2), moved("c", 2, 4)],
    });
  });

  it("an undone remove's step follows the restored placement, so older steps still reach it", () => {
    // add, move, remove; Undo of the remove brings it back as "n".
    const history = { done: [added("a", 0), moved("a", 0, 2)], undone: [removed("a", 2)] };
    const restored = rename(history, "a", "n");
    const back = undo(restored, [view("n", 2, 1)]);
    expect(back?.change).toEqual({ kind: "update", id: "n", version: 1, fields: at(0) });
  });

  it("prune keeps the steps of a placement that is meant to be gone, and drops those of one that vanished", () => {
    // Removed and not undone: the placement is gone, its older steps wait for the Undo that brings it back.
    const gone = { done: [added("a", 0), moved("a", 0, 2), removed("a", 2)], undone: [] };
    expect(prune(gone, [])).toEqual(gone);
    // An add that was undone: nothing is there until Redo.
    const undoneAdd = { done: [], undone: [added("a", 0)] };
    expect(prune(undoneAdd, [])).toEqual(undoneAdd);
    // Meant to be there, removed on another device.
    expect(prune({ done: [added("a", 0)], undone: [] }, [])).toEqual(EMPTY_HISTORY);
    expect(prune({ done: [], undone: [removed("a", 0)] }, [])).toEqual(EMPTY_HISTORY);
  });

  it("advance moves the picked step, and does nothing when that step isn't on top any more (it was pruned in flight), so an older step is not undone with it", () => {
    const older = moved("b", 0, 2);
    const picked = added("a", 4);
    expect(advance({ done: [older, picked], undone: [] }, "undo", picked)).toEqual({ done: [older], undone: [picked] });
    expect(advance({ done: [older], undone: [] }, "undo", picked)).toEqual({ done: [older], undone: [] });
    expect(advance({ done: [], undone: [older, picked] }, "redo", older)).toEqual({ done: [], undone: [older, picked] });
  });
});
