import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Change, DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";

import { useBuilder } from "./use-builder";
import type { Pending, SaveResult } from "./use-planogram-draft";

const actions = vi.hoisted(() => ({ beginDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const toasts = vi.hoisted(() => ({ toast: vi.fn(), dismissToast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

const view = (id: string, col: number, version = 1): PlacementView => ({
  id, faceId: "f", productId: "pant", productName: "Pant", styleNumber: "P", presentation: "hung",
  col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1, version, imageKey: null, categoryName: "",
});
const fields = (p: PlacementView, col: number): PlacementFields => ({ faceId: p.faceId, presentation: p.presentation, col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan, pieceCount: p.pieceCount });
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
  let shown = draft;
  const send = queued(save, () => shown);
  const hook = renderHook(
    ({ d, on }: { d: DraftState | null; on?: boolean }) => {
      shown = d;
      return useBuilder({ fixtureId: "fx", draft: d, expectedVersion: 3, save: send, adopt, onStarted, onStale, describe: () => "here", enabled: on });
    },
    { initialProps: { d: draft } as { d: DraftState | null; on?: boolean } },
  );
  return { ...hook, save, adopt, onStarted, onStale };
}

describe("useBuilder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a move at the placement's version; Undo saves its old fields at the new version", async () => {
    const pant = view("a", 0, 4);
    const { result, rerender, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 4, fields: fields(pant, 4) });
    expect(result.current.announcement).toBe("Moved to here");
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Moved", action: expect.objectContaining({ label: "Undo" }) }));
    rerender({ d: state({ ...pant, col: 4, version: 5 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 5, fields: fields(pant, 0) });
  });

  it("says Switched to hung with the Undo, and Undo puts folded product back (frame racks spec §3)", async () => {
    const folded = { ...view("a", 0, 4), presentation: "folded" as const, faceId: "shelf", colSpan: 4, rowSpan: 2 };
    const hung = { ...folded, presentation: "hung" as const, faceId: "rail", col: 2, colSpan: 2, rowSpan: 1, version: 5 };
    const save = vi.fn().mockResolvedValue({ saved: true, draft: state(hung), notice: "Switched to hung" });
    const { result, rerender } = setup(state(folded), save);
    await act(() => result.current.commit(folded, { ...fields(folded, 2), faceId: "rail" }, "Moved"));

    expect(toasts.toast).toHaveBeenCalledTimes(1);
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Switched to hung", action: expect.objectContaining({ label: "Undo" }) }));
    expect(result.current.announcement).toBe("Switched to hung to here");

    rerender({ d: state(hung) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 5, fields: fields(folded, 0) });
    expect(toasts.toast).toHaveBeenCalledTimes(2);
  });

  it("Undo offers Redo in its toast, for a phone with no keyboard, and Redo offers Undo", async () => {
    const pant = view("a", 0, 4);
    const { result, rerender, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 5 }) });
    await act(() => result.current.undo());
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Undone", action: expect.objectContaining({ label: "Redo" }) }));

    rerender({ d: state({ ...pant, col: 0, version: 6 }) });
    const { action } = toasts.toast.mock.lastCall![0];
    await act(async () => action.onSelect());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 6, fields: fields(pant, 4) });
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Redone", action: expect.objectContaining({ label: "Undo" }) }));
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
        return useBuilder({ fixtureId: "fx", draft: d, expectedVersion: 3, save: send, adopt: vi.fn(), onStarted: vi.fn(), onStale: vi.fn(), describe: () => "here", reveal });
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
    const { result } = setup(state(pant), save);
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    const refused = await act(() => result.current.commit(pant, fields(pant, 6), "Moved"));
    expect(refused).toEqual({ ok: false, message: "Changed on another device" });
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
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
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft started" }));
    expect(save).toHaveBeenCalledWith({ kind: "update", id: "real", version: 1, fields: fields(published, 4) });
    expect(outcome).toEqual({ ok: true, id: "real" });
  });

  it("refuses when the draft another device started no longer has the tile (Review Focus 3)", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state(view("x", 6)) });
    const { result, save } = setup(null);
    const outcome = await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(outcome).toEqual({ ok: false, message: "Changed on another device" });
    expect(save).not.toHaveBeenCalled();
  });

  it("shows the other device's draft on a refusal and never starts a second one (Review Focus 3)", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    const theirs = state(view("x", 6));
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: theirs });
    const { result, rerender, save, adopt } = setup(null);
    await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(adopt).toHaveBeenCalledWith(theirs);
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
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
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
    await act(() => result.current.undo());
    await act(() => result.current.redo());
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("won't undo over a placement another device moved since, even at its fresh version (Review Focus 2)", async () => {
    const pant = view("a", 0);
    const tee = { ...view("b", 10), productId: "tee" };
    const { result, rerender, save } = setup(state(pant, tee));
    await act(() => result.current.commit(tee, fields(tee, 12), "Moved"));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 8, version: 3 }, { ...tee, col: 12, version: 2 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(2);
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "b", version: 2, fields: fields(tee, 10) });
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
    expect(toasts.toast.mock.calls.filter(([t]) => t.title === "Draft started")).toHaveLength(1);
  });

  it("skips steps whose placement left the draft, so Undo isn't stuck", async () => {
    const pant = view("a", 0);
    const tee = { ...view("b", 10), productId: "tee" };
    const { result, rerender, save } = setup(state(pant, tee));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    await act(() => result.current.commit(tee, fields(tee, 12), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 2 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 2, fields: fields(pant, 0) });
  });

  it("ignores Undo while a drag is held", async () => {
    const pant = view("a", 0);
    const { result, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    act(() => result.current.setDragging(true));
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Z undoes, but not while typing in a field", async () => {
    const pant = view("a", 0);
    const { result, rerender, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 2 }) });
    const input = document.createElement("input");
    document.body.append(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    });
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ fields: fields(pant, 0) }));
    input.remove();
  });

  it("while not enabled, Ctrl+Z is left alone and Undo saves nothing", async () => {
    const pant = view("a", 0);
    const { result, rerender, save } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    rerender({ d: state({ ...pant, col: 4, version: 2 }), on: false });
    const press = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true });
    await act(async () => {
      window.dispatchEvent(press);
    });
    expect(press.defaultPrevented).toBe(false);
    await act(() => result.current.undo());
    expect(save).toHaveBeenCalledTimes(1);
    rerender({ d: state({ ...pant, col: 4, version: 2 }), on: true });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ fields: fields(pant, 0) }));
  });

  it("resyncs when the first change is refused with no draft to work in", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    actions.beginDraftAction.mockResolvedValue({ status: "refused", message: "Changed on another device", draft: null });
    const { result, save, onStale } = setup(null);
    const outcome = await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(outcome).toEqual({ ok: false, message: "Changed on another device" });
    expect(toasts.toast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("names the tile a started draft gave the change, before its save is back", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: state(view("real", 0, 1)) });
    const found = vi.fn();
    const save = vi.fn(() => {
      expect(found).toHaveBeenCalledWith("real");
      return Promise.resolve({ saved: true as const, draft: state() });
    });
    const { result } = setup(null, save);
    await act(() => result.current.commit(published, fields(published, 4), "Moved", found));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("a change queued behind another records where the tile sat when it went, so Undo steps back one press (DECISIONS 11-09)", async () => {
    const pant = view("a", 0, 4);
    // The second press was made before the first was back: its target still says col 0, version 4.
    const save = vi
      .fn()
      .mockResolvedValue({ saved: true, draft: state() })
      .mockResolvedValueOnce({ saved: true, draft: state({ ...pant, col: 1, version: 5 }) })
      .mockResolvedValueOnce({ saved: true, draft: state({ ...pant, col: 2, version: 6 }), before: { ...pant, col: 1, version: 5 } });
    const { result, rerender } = setup(state(pant), save);
    await act(() => Promise.all([result.current.commit(pant, fields(pant, 1), "Moved"), result.current.commit(pant, fields(pant, 2), "Moved")]));
    rerender({ d: state({ ...pant, col: 2, version: 6 }) });
    await act(() => result.current.undo());
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 6, fields: fields(pant, 1) });
  });

  it("only the latest change offers Undo: the toast before it goes", async () => {
    const pant = view("a", 0);
    toasts.toast.mockReturnValueOnce(7).mockReturnValueOnce(8);
    const { result } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    expect(toasts.dismissToast).not.toHaveBeenCalled();
    await act(() => result.current.commit(pant, fields(pant, 6), "Moved"));
    expect(toasts.dismissToast).toHaveBeenCalledWith(7);
    expect(toasts.dismissToast).not.toHaveBeenCalledWith(8);
  });

  it("the same words twice still change the live region, so they're read again", () => {
    const { result } = setup(null);
    act(() => result.current.say("Blocked by Tee"));
    const first = result.current.announcement;
    act(() => result.current.say("Blocked by Tee"));
    expect(result.current.announcement).not.toBe(first);
    expect(result.current.announcement.startsWith("Blocked by Tee")).toBe(true);
    expect(first).toBe("Blocked by Tee");
  });
});
