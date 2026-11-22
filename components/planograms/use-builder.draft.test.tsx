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

  it("a typed edit whose placement has left the draft is refused on the status line exactly once, since the form is told it was heard", async () => {
    const pant = view("a", 0, 4);
    const { result, save, refuse } = setup(state(view("x", 6)));
    const outcome = await act(() => result.current.commit(pant, fields(pant, 4), "Changed"));
    expect(outcome).toEqual({ ok: false, message: "Changed on another device" });
    expect(save).not.toHaveBeenCalled();
    expect(refuse).toHaveBeenCalledTimes(1);
    expect(refuse).toHaveBeenCalledWith("Changed on another device");
  });

  it("a nudge built on a tile rendered before a typed width came back keeps that width and moves only the position", async () => {
    const rendered = view("a", 0, 4);
    const { result, save } = setup(state({ ...rendered, colSpan: 4, pieceCount: 9, version: 4 }));
    await act(() => result.current.commit(rendered, fields(rendered, 1), "Moved"));
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 4, fields: { ...fields(rendered, 1), colSpan: 4, pieceCount: 9 } });
  });

  it("shows the other device's draft on a refusal and never starts a second one (Review Focus 3)", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    const theirs = state(view("x", 6));
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: theirs });
    const { result, rerender, save, adopt, refuse } = setup(null);
    await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(adopt).toHaveBeenCalledWith(theirs);
    expect(refuse).toHaveBeenLastCalledWith("Changed on another device");
    expect(toasts.toast).not.toHaveBeenCalled();
    rerender({ d: theirs });
    const again = await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(again).toEqual({ ok: false, message: "Changed on another device" });
    expect(actions.beginDraftAction).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("drops a placement's steps when its Undo is refused, so Redo can't replay them (Review Focus 2)", async () => {
    const pant = view("a", 0);
    const save = vi.fn().mockResolvedValueOnce({ saved: true, draft: state() }).mockResolvedValueOnce({ saved: false, message: "Changed on another device" });
    const { result, rerender } = setup(state(pant), save);
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 2 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(2);
    // The draft's status line says why (it set it when the save was refused): no toast.
    expect(toasts.toast).not.toHaveBeenCalled();
    await act(() => result.current.undo());
    await act(() => result.current.redo());
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("won't undo over a placement another device moved since, even at its fresh version (Review Focus 2)", async () => {
    const pant = view("a", 0);
    const tee = { ...view("b", 10), productId: "tee" };
    const { result, rerender, save, refuse } = setup(state(pant, tee));
    await act(() => result.current.commit(tee, fields(tee, 12), "Moved"));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 8, version: 3 }, { ...tee, col: 12, version: 2 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(2);
    expect(refuse).toHaveBeenLastCalledWith("Changed on another device");
    expect(toasts.toast).not.toHaveBeenCalled();
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "b", version: 2, fields: { ...fields(tee, 10), depth: 0 } });
  });

  it("starts one draft when two changes land before it's back", async () => {
    const pant = view("v-0", 0);
    const tee = { ...view("v-1", 10), productId: "tee" };
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state({ ...pant, id: "p" }, { ...tee, id: "t" }) });
    const { result, adopt, onStarted } = setup(null);
    await act(() => Promise.all([result.current.commit(pant, fields(pant, 4), "Moved"), result.current.commit(tee, fields(tee, 12), "Moved")]));
    expect(actions.beginDraftAction).toHaveBeenCalledTimes(1);
    expect(adopt).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("an add with no draft starts one first, then adds; a refused start adds nothing and says why", async () => {
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state(view("x", 6)) });
    const save = vi.fn().mockResolvedValue({ saved: true, draft: state(view("x", 6), view("y", 0)), id: "y" });
    const { result, adopt, onStarted, onStale } = setup(null, save);
    const pant = view("y", 0);
    const made = await act(() => result.current.add("pant", () => fields(pant, 0)));
    expect(actions.beginDraftAction).toHaveBeenCalledWith("fx", 3);
    expect(adopt).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ kind: "add", productId: "pant", fields: fields(pant, 0) });
    expect(made).toMatchObject({ saved: true, id: "y" });
    expect(toasts.toast).not.toHaveBeenCalled();

    actions.beginDraftAction.mockResolvedValue({ status: "refused", message: "Published again on another device.", draft: null });
    const again = setup(null, save);
    save.mockClear();
    expect(await act(() => again.result.current.add("pant", () => fields(pant, 0)))).toEqual({ saved: false, message: "Published again on another device." });
    expect(again.onStale).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(onStale).not.toHaveBeenCalled();
  });

  it("an add picks its spot among the draft that came back, not the version the draft was started from", async () => {
    // Another device's draft already holds a pant at col 0, which the latest version didn't have.
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state(view("x", 0)) });
    const save = vi.fn().mockResolvedValue({ saved: true, draft: state(view("x", 0), view("y", 2)), id: "y" });
    const { result } = setup(null, save);
    const pant = view("y", 0);
    const pick = vi.fn((others: readonly PlacementView[]) => fields(pant, others.some((p) => p.col === 0) ? 2 : 0));
    await act(() => result.current.add("pant", pick));
    expect(pick).toHaveBeenCalledWith([view("x", 0)]);
    expect(save).toHaveBeenCalledWith({ kind: "add", productId: "pant", fields: fields(pant, 2) });
  });

  it("an add with no room in the draft that came back saves nothing and hands back why", async () => {
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state(view("x", 0)) });
    const { result, save, onStarted } = setup(null);
    const made = await act(() => result.current.add("pant", () => "No open spot fits Pant."));
    expect(made).toEqual({ saved: false, message: "No open spot fits Pant." });
    expect(save).not.toHaveBeenCalled();
    // The draft did start; the Add dialog, still open, shows the reason the reply carries.
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it("a + and a move that both find no draft start one between them", async () => {
    const pant = view("v-0", 0);
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state({ ...pant, id: "p" }) });
    const { result, adopt } = setup(null);
    await act(() => Promise.all([result.current.add("tee", () => fields(pant, 6)), result.current.commit(pant, fields(pant, 4), "Moved")]));
    expect(actions.beginDraftAction).toHaveBeenCalledTimes(1);
    expect(adopt).toHaveBeenCalledTimes(1);
  });

  it("skips steps whose placement left the draft, so Undo isn't stuck", async () => {
    const pant = view("a", 0);
    const tee = { ...view("b", 10), productId: "tee" };
    const { result, rerender, save } = setup(state(pant, tee));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    await act(() => result.current.commit(tee, fields(tee, 12), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 2 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 2, fields: { ...fields(pant, 0), depth: 0 } });
  });
});
