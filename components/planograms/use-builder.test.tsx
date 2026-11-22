import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Change, DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";

import { useBuilder } from "./use-builder";

import type { Pending, SaveResult } from "./use-planogram-draft";

const actions = vi.hoisted(() => ({ beginDraftAction: vi.fn(), saveChangeAction: vi.fn(), reloadDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const toasts = vi.hoisted(() => ({ toast: vi.fn(), dismissToast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

const view = (id: string, col: number, version = 1): PlacementView => ({
  depth: 0,
  id, faceId: "f", productId: "pant", productName: "Pant", styleNumber: "P", presentation: "hung",
  col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1, version, imageKey: null, categoryName: "",
});
const fields = (p: PlacementView, col: number): PlacementFields => ({ faceId: p.faceId, presentation: p.presentation, col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan, pieceCount: p.pieceCount });
// Undo and Redo ask for the depth the step left (hung layers): every tile here is at the front.
const state = (...placements: PlacementView[]): DraftState => ({ planogramVersion: 1, placements });

/** The draft hook's queue, one change at a time: a picked change is picked from the draft shown; `save` sees what's sent. */
function queued(save: (change: Change) => Promise<SaveResult>, shown: () => DraftState | null) {
  return (pending: Pending): Promise<SaveResult> => {
    const change = typeof pending === "function" ? pending(shown()) : pending;
    return change ? save(change) : Promise.resolve({ saved: false, message: null });
  };
}

function setup(draft: DraftState | null, save = vi.fn().mockResolvedValue({ saved: true, draft: state() })) {
  const adopt = vi.fn();
  const onStarted = vi.fn();
  const onStale = vi.fn();
  // The draft's own status line, which a refusal that never reached the server is told on.
  const refuse = vi.fn();
  let shown = draft;
  const send = queued(save, () => shown);
  const hook = renderHook(
    ({ d, on }: { d: DraftState | null; on?: boolean }) => {
      shown = d;
      return useBuilder({ fixtureId: "fx", draft: d, expectedVersion: 3, save: send, adopt, onStarted, onStale, refuse, describe: () => "here", enabled: on });
    },
    { initialProps: { d: draft } as { d: DraftState | null; on?: boolean } },
  );
  return { ...hook, save, adopt, onStarted, onStale, refuse };
}

describe("useBuilder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a move at the placement's version; Undo saves its old fields at the new version", async () => {
    const pant = view("a", 0, 4);
    const { result, rerender, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 4, fields: fields(pant, 4) });
    expect(result.current.announcement).toBe("Moved to here");
    // The corner bar’s Undo icon is the way back: no toast offers it.
    expect(toasts.toast).not.toHaveBeenCalled();
    rerender({ d: state({ ...pant, col: 4, version: 5 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 5, fields: { ...fields(pant, 0), depth: 0 } });
  });

  it("canUndo and canRedo follow the stack: a change enables Undo, Undo enables Redo", async () => {
    const pant = view("a", 0, 4);
    const { result, rerender } = setup(state(pant));
    expect([result.current.canUndo, result.current.canRedo]).toEqual([false, false]);
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    expect([result.current.canUndo, result.current.canRedo]).toEqual([true, false]);
    rerender({ d: state({ ...pant, col: 4, version: 5 }) });
    await act(() => result.current.undo());
    expect([result.current.canUndo, result.current.canRedo]).toEqual([false, true]);
    act(() => result.current.clearHistory());
    expect([result.current.canUndo, result.current.canRedo]).toEqual([false, false]);
  });

  it("an add and a remove go on the stack: Undo of the add removes it, Undo of the remove adds it back", async () => {
    const pant = { ...view("a", 0, 4), depth: 2 };
    const save = vi.fn().mockResolvedValue({ saved: true, draft: state(pant), id: "a" });
    const { result, rerender } = setup(state(), save);
    await act(() => result.current.add("pant", () => fields(pant, 0)));
    rerender({ d: state(pant) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "remove", id: "a", version: 4 });

    save.mockResolvedValue({ saved: true, draft: state(), before: pant });
    rerender({ d: state(pant) });
    await act(() => result.current.remove(pant));
    expect(save).toHaveBeenLastCalledWith({ kind: "remove", id: "a", version: 4 });
    rerender({ d: state() });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "add", productId: "pant", fields: { ...fields(pant, 0), depth: 2 } });
  });

  it("says Switched to hung (no toast), and Undo puts folded product back (frame racks spec §3)", async () => {
    const folded = { ...view("a", 0, 4), presentation: "folded" as const, faceId: "shelf", colSpan: 4, rowSpan: 2 };
    const hung = { ...folded, presentation: "hung" as const, faceId: "rail", col: 2, colSpan: 2, rowSpan: 1, version: 5 };
    const save = vi.fn().mockResolvedValue({ saved: true, draft: state(hung), notice: "Switched to hung" });
    const { result, rerender } = setup(state(folded), save);
    await act(() => result.current.commit(folded, { ...fields(folded, 2), faceId: "rail" }, "Moved"));

    expect(toasts.toast).not.toHaveBeenCalled();
    expect(result.current.announcement).toBe("Switched to hung to here");

    rerender({ d: state(hung) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 5, fields: { ...fields(folded, 0), depth: 0 } });
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("Undo and Redo say what they did in the live region and show no toast: the corner bar’s icons are the way back", async () => {
    const pant = view("a", 0, 4);
    const { result, rerender, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 5 }) });
    await act(() => result.current.undo());
    expect(result.current.announcement).toBe("Undone: here");

    rerender({ d: state({ ...pant, col: 0, version: 6 }) });
    await act(() => result.current.redo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 6, fields: fields(pant, 4) });
    expect(result.current.announcement).toBe("Redone: here");
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("Undo onto another face shows that face and names it", async () => {
    const pant = view("a", 0, 4);
    const reveal = vi.fn().mockReturnValue("Back");
    const save = vi.fn().mockResolvedValue({ saved: true, draft: state() });
    let shown = state(pant);
    const send = queued(save, () => shown);
    const { result, rerender } = renderHook(
      ({ d }: { d: DraftState }) => {
        shown = d;
        return useBuilder({ fixtureId: "fx", draft: d, expectedVersion: 3, save: send, adopt: vi.fn(), refuse: vi.fn(), onStarted: vi.fn(), onStale: vi.fn(), describe: () => "here", reveal });
      },
      { initialProps: { d: state(pant) } },
    );
    await act(() => result.current.commit(pant, { ...fields(pant, 0), faceId: "other" }, "Moved"));
    rerender({ d: state({ ...pant, faceId: "other", version: 5 }) });
    await act(() => result.current.undo());
    expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ faceId: "f" }));
    expect(result.current.announcement).toBe("Undone: here, on Back");
  });

  it("drops a placement's undo steps when another device changed it (Review Focus 2)", async () => {
    const pant = view("a", 0);
    const save = vi.fn().mockResolvedValueOnce({ saved: true, draft: state() }).mockResolvedValueOnce({ saved: false, message: "Changed on another device" });
    const { result, refuse } = setup(state(pant), save);
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    const refused = await act(() => result.current.commit(pant, fields(pant, 6), "Moved"));
    expect(refused).toEqual({ ok: false, message: "Changed on another device" });
    // The draft's save already set its status line; the builder neither toasts nor says it twice.
    expect(toasts.toast).not.toHaveBeenCalled();
    expect(refuse).not.toHaveBeenCalled();
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("starts a draft on the first move with none, and saves the tile it became", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    const started = state(view("real", 0, 1));
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: started });
    const { result, save, adopt, onStarted } = setup(null);
    const outcome = await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(actions.beginDraftAction).toHaveBeenCalledWith("fx", 3);
    expect(adopt).toHaveBeenCalledWith(started);
    expect(onStarted).toHaveBeenCalled();
    expect(toasts.toast).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith({ kind: "update", id: "real", version: 1, fields: fields(published, 4) });
    expect(outcome).toMatchObject({ ok: true, id: "real" });
  });

  it("refuses when the draft another device started no longer has the tile (Review Focus 3)", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state(view("x", 6)) });
    const { result, save } = setup(null);
    const outcome = await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(outcome).toEqual({ ok: false, message: "Changed on another device" });
    expect(save).not.toHaveBeenCalled();
  });
});
