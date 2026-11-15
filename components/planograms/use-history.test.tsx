// A clear (the draft is gone) wins over an Undo or Redo still in flight (0.7.0.5 task 2 review):
// the stale reply must not refill a history for a dead draft; a connection error still keeps it.

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacementFields, PlacementView } from "@/lib/planograms/types";

import { toast } from "@/lib/toast";

import { useHistory } from "./use-history";
import type { Pending, SaveResult } from "./use-planogram-draft";

vi.mock("@/lib/toast", () => ({ toast: vi.fn(() => 1), dismissToast: vi.fn() }));

const at = (col: number): PlacementFields => ({ faceId: "f", presentation: "hung", col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1 });
const view = (col: number): PlacementView => ({ ...at(col), id: "a", productId: "pant", productName: "Pant", styleNumber: "P", version: 2, depth: 0, imageKey: null, categoryName: "" });
const held = { planogramVersion: 2, placements: [view(4)] };
const nothing: SaveResult = { saved: false, message: null };

/** A save that picks its change on the draft as held, then waits for `reply` to be settled by the test. */
function flight() {
  let settle: (result: SaveResult) => void = () => {};
  const save = vi.fn((pending: Pending) => {
    if (typeof pending === "function") pending(held);
    return new Promise<SaveResult>((resolve) => {
      settle = resolve;
    });
  });
  return { save, reply: (result: SaveResult) => settle(result) };
}

function setUp(save: ReturnType<typeof flight>["save"]) {
  const latest = { current: { enabled: true } };
  const dragging = { current: false };
  const hook = renderHook(() => useHistory({ save, latest, dragging, say: vi.fn(), describe: () => "" }));
  act(() => hook.result.current.record({ kind: "update", id: "a", before: at(2), after: at(4) }));
  return hook;
}

describe("Undo or Redo in flight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a clear between the pick and a saved reply leaves the history empty", async () => {
    const f = flight();
    const { result } = setUp(f.save);
    let travel: Promise<void> = Promise.resolve();
    act(() => {
      travel = result.current.undo();
    });
    act(() => result.current.clear());
    await act(async () => {
      f.reply({ saved: true, draft: held });
      await travel;
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("a clear between the pick and the empty reply the draft's gone path gives leaves it empty too", async () => {
    const f = flight();
    const { result } = setUp(f.save);
    let travel: Promise<void> = Promise.resolve();
    act(() => {
      travel = result.current.undo();
    });
    act(() => result.current.clear());
    await act(async () => {
      f.reply(nothing);
      await travel;
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("a connection error with no clear keeps the history, so Undo is still offered", async () => {
    const f = flight();
    const { result } = setUp(f.save);
    let travel: Promise<void> = Promise.resolve();
    act(() => {
      travel = result.current.undo();
    });
    await act(async () => {
      f.reply(nothing);
      await travel;
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("an Undo after a clear works on the new history again", async () => {
    const f = flight();
    const { result } = setUp(f.save);
    act(() => result.current.clear());
    act(() => result.current.record({ kind: "update", id: "a", before: at(2), after: at(4) }));
    let travel: Promise<void> = Promise.resolve();
    act(() => {
      travel = result.current.undo();
    });
    await act(async () => {
      f.reply({ saved: true, draft: held });
      await travel;
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("a draft taken in drops steps for tiles gone elsewhere, quietly; not a remove step, and not the tile the change is about", async () => {
    const f = flight();
    const { result } = setUp(f.save);
    act(() => result.current.record({ kind: "update", id: "gone", before: at(2), after: at(4) }));
    act(() => result.current.record({ kind: "remove", id: "removed", productId: "tee", fields: at(0) }));
    act(() => result.current.record({ kind: "update", id: "changing", before: at(2), after: at(4) }));
    act(() => result.current.take(held, held, "changing"));
    // a (here), the remove step and the changing tile stay; gone goes without a word.
    await act(async () => {
      const travel = result.current.undo();
      f.reply({ saved: true, draft: held });
      await travel;
    });
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ tone: "error" }));
    expect(result.current.canUndo).toBe(true);
  });

  it("a draft taken in drops the steps for tiles gone elsewhere at once, so Undo is not offered for them", () => {
    const { result } = setUp(flight().save);
    act(() => result.current.forget("a"));
    act(() => result.current.record({ kind: "update", id: "gone", before: at(2), after: at(4) }));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.take(held, held));
    expect(result.current.canUndo).toBe(false);
  });

  it("a reply that drops a step while an Undo is in flight is not undone by that Undo landing", async () => {
    const f = flight();
    const { result } = setUp(f.save);
    act(() => result.current.record({ kind: "update", id: "gone", before: at(2), after: at(4) }));
    act(() => result.current.record({ kind: "update", id: "a", before: at(6), after: at(8) }));
    let travel: Promise<void> = Promise.resolve();
    act(() => {
      travel = result.current.undo();
    });
    // Meanwhile a reply (another device's) says "gone" is gone; the step in flight is for a (the draft still holds it).
    act(() => result.current.take(held, held));
    await act(async () => {
      f.reply({ saved: true, draft: held });
      await travel;
    });
    // The next Undo finds nothing to undo: "gone"'s step was dropped in between and stays dropped.
    await act(async () => {
      const travel = result.current.undo();
      f.reply(nothing);
      await travel;
    });
    expect(result.current.canUndo).toBe(false);
  });
});
