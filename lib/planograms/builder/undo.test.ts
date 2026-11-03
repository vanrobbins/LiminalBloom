import { describe, expect, it } from "vitest";

import type { PlacementFields, PlacementView } from "../types";

import { EMPTY_HISTORY, forget, prune, record, redo, sitsAt, undo, type Step } from "./undo";

const at = (col: number): PlacementFields => ({ faceId: "f", presentation: "hung", col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1 });
const view = (id: string, col: number, version: number): PlacementView => ({
  ...at(col), id, productId: id, productName: id, styleNumber: id, imageKey: null, categoryName: "", version,
});
const moved = (id: string, from: number, to: number): Step => ({ id, before: at(from), after: at(to) });

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

  it("keeps the last 50 steps", () => {
    let history = EMPTY_HISTORY;
    for (let i = 0; i < 60; i++) history = record(history, moved(`p${i}`, 0, 1));
    expect(history.done).toHaveLength(50);
    expect(history.done[0].id).toBe("p10");
  });
});
