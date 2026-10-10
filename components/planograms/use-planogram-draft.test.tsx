import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftState } from "@/lib/planograms/types";

import { usePlanogramDraft } from "./use-planogram-draft";

const actions = vi.hoisted(() => ({ saveChangeAction: vi.fn(), reloadDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);

const draft = (n: number): DraftState => ({ planogramVersion: n, placements: [] });
const remove = { kind: "remove" as const, id: "00000000-0000-4000-8000-000000000001", version: 1 };

describe("usePlanogramDraft", () => {
  beforeEach(() => vi.resetAllMocks());

  it("takes the server's whole draft after a save", async () => {
    actions.saveChangeAction.mockResolvedValue({ status: "saved", draft: draft(5) });
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    await act(() => result.current.save(remove));
    expect(result.current.draft).toEqual(draft(5));
    expect(result.current.status).toEqual({ kind: "saved" });
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

  it("sends one change at a time", async () => {
    let finish: (v: unknown) => void = () => {};
    actions.saveChangeAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => usePlanogramDraft("fx", draft(1), vi.fn()));
    let second: unknown;
    await act(async () => {
      void result.current.save(remove);
      second = await result.current.save(remove);
    });
    expect(second).toEqual({ saved: false, message: null });
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
    await act(async () => finish({ status: "saved", draft: draft(2) }));
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
});
