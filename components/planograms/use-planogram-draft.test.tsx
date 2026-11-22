import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("note puts words on the status line beside Saved, and the next save's Saved has none", async () => {
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(5) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    await act(() => result.current.save(remove));
    act(() => result.current.note("Placed at the nearest open spot"));
    expect(result.current.status).toEqual({ kind: "saved", note: "Placed at the nearest open spot" });
    await act(() => result.current.save(remove));
    expect(result.current.status).toEqual({ kind: "saved" });
  });

  describe("the note", () => {
    afterEach(() => vi.useRealTimers());

    it("clears itself after a few seconds, back to a plain Saved", async () => {
      actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(5) });
      const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
      await act(() => result.current.save(remove));
      vi.useFakeTimers();
      act(() => result.current.note("Placed at the nearest open spot"));
      act(() => void vi.advanceTimersByTime(3900));
      expect(result.current.status).toEqual({ kind: "saved", note: "Placed at the nearest open spot" });
      act(() => void vi.advanceTimersByTime(200));
      expect(result.current.status).toEqual({ kind: "saved" });
    });

    it("does not wipe a refusal that came after it", async () => {
      actions.saveChangeAction.mockResolvedValue({ status: "refused", message: "No room", draft: draft(5) });
      const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
      vi.useFakeTimers();
      act(() => result.current.note("Placed at the nearest open spot"));
      await act(() => result.current.save(remove));
      expect(result.current.status).toEqual({ kind: "refused", message: "No room" });
      act(() => void vi.advanceTimersByTime(10_000));
      expect(result.current.status).toEqual({ kind: "refused", message: "No room" });
    });

    it("a second note gets its full time, not what was left of the first", async () => {
      const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
      vi.useFakeTimers();
      act(() => result.current.note("one"));
      act(() => void vi.advanceTimersByTime(3000));
      act(() => result.current.note("two"));
      act(() => void vi.advanceTimersByTime(3000));
      expect(result.current.status).toEqual({ kind: "saved", note: "two" });
    });
  });

  it("a refusal made while a save is out is not erased by that save's Saved, and the next save replaces it", async () => {
    let finish: (reply: unknown) => void = () => {};
    actions.saveChangeAction.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let saving: Promise<unknown> = Promise.resolve();
    await act(async () => void (saving = result.current.save(remove)));
    expect(result.current.status).toEqual({ kind: "saving" });
    act(() => result.current.refuse("That doesn't fit"));
    await act(async () => {
      finish({ status: "saved", draft: draft(5) });
      await saving;
    });
    expect(result.current.status).toEqual({ kind: "refused", message: "That doesn't fit" });
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(6) });
    await act(() => result.current.save(remove));
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
});
