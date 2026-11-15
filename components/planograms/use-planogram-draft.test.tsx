import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";

import { usePlanogramDraft } from "./use-planogram-draft";

const actions = vi.hoisted(() => ({ saveChangeAction: vi.fn(), reloadDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

const draft = (n: number): DraftState => ({ planogramVersion: n, placements: [] });
const remove = { kind: "remove" as const, id: "00000000-0000-4000-8000-000000000001", version: 1 };
const ID = "00000000-0000-4000-8000-000000000002";
const at = (col: number): PlacementFields => ({ faceId: "f", presentation: "hung", col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1 });
const update = (version: number, col: number) => ({ kind: "update" as const, id: ID, version, fields: at(col) });
const placed = (version: number, col = 0): PlacementView => ({ ...at(col), id: ID, productId: "pant", productName: "Pant", styleNumber: "P", version, depth: 0, imageKey: null, categoryName: "" });
const withTile = (n: number, tile: PlacementView): DraftState => ({ planogramVersion: n, placements: [tile] });

describe("usePlanogramDraft", () => {
  beforeEach(() => vi.resetAllMocks());

  it("takes the server's whole draft after a save", async () => {
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(5) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    await act(() => result.current.save(remove));
    expect(result.current.draft).toEqual(draft(5));
    expect(result.current.status).toEqual({ kind: "saved" });
  });

  it("returns the saved draft with a save", async () => {
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(5) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let reply: unknown;
    await act(async () => {
      reply = await result.current.save(remove);
    });
    expect(reply).toEqual({ saved: true, draft: draft(5) });
  });

  it("returns the id the server gave an add, not one picked from the draft", async () => {
    const theirs = { ...placed(1, 2), id: "theirs" };
    const mine = { ...placed(1, 4), id: "mine" };
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: { planogramVersion: 2, placements: [theirs, mine] }, id: "mine" });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let reply: unknown;
    await act(async () => {
      reply = await result.current.save({ kind: "add", productId: "pant", fields: at(2) });
    });
    expect(reply).toMatchObject({ saved: true, id: "mine" });
  });

  it("an add whose reply names no id returns none, even when the draft holds a new placement of that product", async () => {
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: { planogramVersion: 2, placements: [{ ...placed(1, 2), id: "theirs" }] } });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let reply: unknown;
    await act(async () => {
      reply = await result.current.save({ kind: "add", productId: "pant", fields: at(2) });
    });
    expect(reply).not.toHaveProperty("id");
  });

  it("adopts a draft started on this page, and reloads it on focus from then on", async () => {
    actions.reloadDraftAction.mockResolvedValue(draft(4));
    const { result } = renderHook(() => usePlanogramDraft("fx", null, vi.fn()));
    act(() => result.current.adopt(draft(2)));
    expect(result.current.draft).toEqual(draft(2));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.draft).toEqual(draft(4)));
  });

  it("shows a refusal and still takes the current draft", async () => {
    actions.saveChangeAction.mockResolvedValue({ status: "refused", message: "Changed on another device", draft: draft(3) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let reply: unknown;
    await act(async () => {
      reply = await result.current.save(remove);
    });
    expect(reply).toEqual({ saved: false, message: "Changed on another device" });
    expect(result.current.status).toEqual({ kind: "refused", message: "Changed on another device" });
    expect(result.current.draft).toEqual(draft(3));
  });

  it("queues a change made while one is saving, and sends it once that one is back (DECISIONS 11-09)", async () => {
    let finish: (v: unknown) => void = () => {};
    actions.saveChangeAction.mockReturnValueOnce(new Promise((resolve) => (finish = resolve))).mockResolvedValueOnce({ status: "saved", draft: draft(3) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      void result.current.save(remove);
      second = result.current.save({ kind: "add", productId: "p", fields: at(2) });
    });
    await act(async () => {});
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
    await act(async () => finish({ status: "saved", draft: draft(2) }));
    await act(() => second);
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toEqual({ saved: true, draft: draft(3) });
    expect(result.current.draft).toEqual(draft(3));
  });

  it("brings a queued change up to the version this device's own save left, and says where the tile sat when it went", async () => {
    actions.saveChangeAction
      .mockResolvedValueOnce({ status: "saved", draft: withTile(2, placed(5, 1)) })
      .mockResolvedValueOnce({ status: "saved", draft: withTile(3, placed(6, 2)) });
    const { result } = renderHook(() => usePlanogramDraft("fx", withTile(1, placed(4)), vi.fn()));
    let replies: unknown[] = [];
    await act(async () => {
      // Both pressed before either is back: both carry version 4.
      replies = await Promise.all([result.current.save(update(4, 1)), result.current.save(update(4, 2))]);
    });
    expect(actions.saveChangeAction).toHaveBeenNthCalledWith(1, "fx", update(4, 1));
    expect(actions.saveChangeAction).toHaveBeenNthCalledWith(2, "fx", update(5, 2));
    expect(replies[1]).toEqual(expect.objectContaining({ saved: true, before: placed(5, 1) }));
  });

  it("never brings a change past another device's version, so its edit is still refused", async () => {
    actions.saveChangeAction
      .mockResolvedValueOnce({ status: "saved", draft: withTile(2, placed(5, 1)) })
      .mockResolvedValueOnce({ status: "refused", message: "Changed on another device", draft: withTile(3, placed(8, 6)) });
    const { result } = renderHook(() => usePlanogramDraft("fx", withTile(1, placed(4)), vi.fn()));
    await act(() => result.current.save(update(4, 1)));
    // Shown at version 7 (another device's): not one of this device's own.
    await act(() => result.current.save(update(7, 2)));
    expect(actions.saveChangeAction).toHaveBeenLastCalledWith("fx", update(7, 2));
  });

  it("picks a queued Undo from the draft the change before it left", async () => {
    let finish: (v: unknown) => void = () => {};
    actions.saveChangeAction.mockReturnValueOnce(new Promise((resolve) => (finish = resolve))).mockResolvedValue({ status: "saved", draft: draft(4) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    const pick = vi.fn((held: DraftState | null) => (held?.planogramVersion === 3 ? remove : null));
    let picked: Promise<unknown> = Promise.resolve();
    act(() => {
      void result.current.save(remove);
      picked = result.current.save(pick);
    });
    await act(async () => {});
    expect(pick).not.toHaveBeenCalled();
    await act(async () => finish({ status: "saved", draft: draft(3) }));
    await act(() => picked);
    expect(pick).toHaveBeenCalledWith(draft(3));
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(2);
  });

  it("a picked change of null sends nothing", async () => {
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let reply: unknown;
    await act(async () => {
      reply = await result.current.save(() => null);
    });
    expect(reply).toEqual({ saved: false, message: null });
    expect(actions.saveChangeAction).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  it("a failed connection drops what was queued behind it, with one toast; a change made after is sent", async () => {
    let fail: (e: Error) => void = () => {};
    actions.saveChangeAction.mockReturnValueOnce(new Promise((_, reject) => (fail = reject))).mockResolvedValue({ status: "saved", draft: draft(2) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let queued: Promise<unknown> = Promise.resolve();
    act(() => {
      void result.current.save(remove);
      queued = result.current.save(remove);
    });
    await act(async () => fail(new Error("offline")));
    await expect(queued).resolves.toEqual({ saved: false, message: null });
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
    expect(toasts.toast).toHaveBeenCalledTimes(1);
    await act(() => result.current.save(remove));
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(2);
  });

  it("reloads when the tab regains focus, and reports a draft that is gone", async () => {
    const onGone = vi.fn();
    actions.reloadDraftAction.mockResolvedValueOnce(draft(9)).mockResolvedValueOnce(null);
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), onGone));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.draft).toEqual(draft(9)));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(onGone).toHaveBeenCalled());
  });

  it("keeps a newer save's draft when a slower reload comes back with an older one", async () => {
    let finishReload: (v: DraftState) => void = () => {};
    actions.reloadDraftAction.mockReturnValue(new Promise((resolve) => (finishReload = resolve)));
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(5) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    act(() => window.dispatchEvent(new Event("focus"))); // the reload reads version 4…
    await act(() => result.current.save(remove)); // …a save lands version 5…
    await act(async () => finishReload(draft(4))); // …then the reload's reply arrives.
    expect(result.current.draft).toEqual(draft(5));
  });

  it("reloads once when focus and visibilitychange fire together", async () => {
    actions.reloadDraftAction.mockResolvedValue(draft(2));
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current.draft).toEqual(draft(2)));
    expect(actions.reloadDraftAction).toHaveBeenCalledTimes(1);
  });

  it("a refusal with no draft left (published or discarded elsewhere) reloads the page", async () => {
    const onGone = vi.fn();
    actions.saveChangeAction.mockResolvedValue({ status: "refused", message: "Changed on another device", draft: null });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), onGone));
    await act(() => result.current.save(remove));
    expect(onGone).toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "idle" });
  });

  it("a draft that is gone, however it's found out, clears what the builder registered before the page reloads", async () => {
    const order: string[] = [];
    const onGone = vi.fn(() => order.push("reload"));
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), onGone));
    result.current.onLeaveRef.current = () => order.push("clear");

    actions.saveChangeAction.mockResolvedValue({ status: "refused", message: "Changed on another device", draft: null });
    await act(() => result.current.save(remove));
    actions.reloadDraftAction.mockResolvedValue(null);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(order).toEqual(["clear", "reload", "clear", "reload"]));
    // Publish and discard call it themselves.
    act(() => result.current.leave());
    expect(order.slice(-2)).toEqual(["clear", "reload"]);
  });

  it("tells the history of every draft it takes in: the one it held, the new one, and the placement its own change was about", async () => {
    const onTake = vi.fn();
    const { result } = renderHook(() => usePlanogramDraft("fx", withTile(1, placed(1)), vi.fn()));
    result.current.onTakeRef.current = onTake;
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: withTile(2, placed(2, 4)) });
    await act(() => result.current.save(update(1, 4)));
    expect(onTake).toHaveBeenCalledWith(withTile(1, placed(1)), withTile(2, placed(2, 4)), ID);
    // A reload on coming back to the tab is another device's edits arriving: no placement of its own.
    actions.reloadDraftAction.mockResolvedValue(withTile(3, placed(3, 6)));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(onTake).toHaveBeenLastCalledWith(withTile(2, placed(2, 4)), withTile(3, placed(3, 6)), undefined));
  });

  it("an add's reply tells the history the id the server gave it; a reply older than the draft held is not taken in", async () => {
    const onTake = vi.fn();
    const { result } = renderHook(() => usePlanogramDraft("fx", withTile(5, placed(5)), vi.fn()));
    result.current.onTakeRef.current = onTake;
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: withTile(6, placed(6)), id: ID });
    await act(() => result.current.save({ kind: "add", productId: "pant", fields: at(0) }));
    expect(onTake).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), ID);
    onTake.mockClear();
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: withTile(2, placed(2)) });
    await act(() => result.current.save(update(6, 4)));
    expect(onTake).not.toHaveBeenCalledWith(expect.anything(), withTile(2, placed(2)), expect.anything());
  });

  it("returns where the tile sat among the tiles it overlaps, before and after, for the step it records", async () => {
    const [front, back] = [{ ...placed(1), id: "front", depth: 0 }, { ...placed(1), id: ID, depth: 1 }];
    const { result } = renderHook(() => usePlanogramDraft("fx", { planogramVersion: 1, placements: [front, back] }, vi.fn()));
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: { planogramVersion: 2, placements: [{ ...front, depth: 1 }, { ...back, depth: 0 }] } });
    let reply: unknown;
    await act(async () => {
      reply = await result.current.save(update(1, 0));
    });
    expect(reply).toMatchObject({ saved: true, ahead: { before: { front: ["front"], back: [], prev: "front" }, after: { front: [], back: ["front"], prev: null } } });
  });
});
