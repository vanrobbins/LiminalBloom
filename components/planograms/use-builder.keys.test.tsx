import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Change, DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";

import { useBuilder } from "./use-builder";
import { usePlanogramDraft } from "./use-planogram-draft";
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
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ fields: { ...fields(pant, 0), depth: 0 } }));
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
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ fields: { ...fields(pant, 0), depth: 0 } }));
  });

  it("resyncs when the first change is refused with no draft to work in", async () => {
    const published = { ...view("v-0", 0), id: "v-0" };
    actions.beginDraftAction.mockResolvedValue({ status: "refused", message: "Changed on another device", draft: null });
    const { result, save, onStale, refuse } = setup(null);
    const outcome = await act(() => result.current.commit(published, fields(published, 4), "Moved"));
    expect(outcome).toEqual({ ok: false, message: "Changed on another device" });
    expect(refuse).toHaveBeenLastCalledWith("Changed on another device");
    expect(toasts.toast).not.toHaveBeenCalled();
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
    expect(save).toHaveBeenLastCalledWith({ kind: "update", id: "a", version: 6, fields: { ...fields(pant, 1), depth: 0 } });
  });

  it("changes leave no Undo toast behind to go stale: nothing is shown, nothing is dismissed", async () => {
    const pant = view("a", 0);
    const { result } = setup(state(pant));
    await act(() => result.current.commit(pant, fields(pant, 4), "Moved"));
    await act(() => result.current.commit(pant, fields(pant, 6), "Moved"));
    expect(toasts.toast).not.toHaveBeenCalled();
    expect(toasts.dismissToast).not.toHaveBeenCalled();
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

  it("an Undo pressed while this device's move is still saving undoes that move, not \"Changed on another device\" (B3)", async () => {
    const pant = view("a", 0, 1);
    let release: () => void = () => {};
    actions.saveChangeAction
      .mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve({ status: "saved", draft: state({ ...pant, col: 4, version: 2 }) }))),
      )
      .mockResolvedValueOnce({ status: "saved", draft: state({ ...pant, col: 0, version: 3 }) });
    // The real draft queue under the builder: the order the two hooks hand off in is what's tested.
    const { result } = renderHook(() => {
      const draft = usePlanogramDraft("fx", state(pant), vi.fn());
      const builder = useBuilder({ fixtureId: "fx", draft: draft.draft, expectedVersion: 3, save: draft.save, adopt: draft.adopt, refuse: draft.refuse, onStarted: vi.fn(), onStale: vi.fn(), describe: () => "here" });
      return builder;
    });

    let moved: Promise<unknown> = Promise.resolve();
    let undone: Promise<unknown> = Promise.resolve();
    act(() => {
      moved = result.current.commit(pant, fields(pant, 4), "Moved");
    });
    await waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(1));
    await act(async () => {
      undone = result.current.undo();
      release();
      await Promise.all([moved, undone]);
    });

    expect(actions.saveChangeAction).toHaveBeenCalledTimes(2);
    expect(actions.saveChangeAction).toHaveBeenLastCalledWith("fx", { kind: "update", id: "a", version: 2, fields: { ...fields(pant, 0), depth: 0 } });
    expect(toasts.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Changed on another device" }));
    expect(toasts.toast).not.toHaveBeenCalled();
  });
});
