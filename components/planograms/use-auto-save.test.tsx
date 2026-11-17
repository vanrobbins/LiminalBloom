import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAVE_DELAY_MS, flushPendingEdits, useAutoSave } from "./use-auto-save";

describe("useAutoSave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("commits the latest value once, 600 ms after the last change", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useAutoSave<string>(commit));
    act(() => result.current.later("a"));
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1));
    act(() => result.current.later("ab"));
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1));
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("ab");
    act(() => vi.advanceTimersByTime(5000));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("now commits at once and cancels what was waiting", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useAutoSave<string>(commit));
    act(() => result.current.later("typed"));
    act(() => result.current.now("chosen"));
    expect(commit).toHaveBeenCalledWith("chosen");
    act(() => vi.advanceTimersByTime(5000));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("flush (a blur) commits what is waiting, once, and does nothing when nothing is", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useAutoSave<string>(commit));
    act(() => result.current.flush());
    expect(commit).not.toHaveBeenCalled();
    act(() => result.current.later("typed"));
    act(() => result.current.flush());
    act(() => result.current.flush());
    act(() => vi.advanceTimersByTime(5000));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("typed");
  });

  it("flushes on unmount, through the commit of the last render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender, unmount } = renderHook(({ commit }) => useAutoSave<string>(commit), { initialProps: { commit: first } });
    act(() => result.current.later("typed"));
    rerender({ commit: second });
    unmount();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("typed");
    act(() => vi.advanceTimersByTime(5000));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on unmount when nothing is waiting", () => {
    const commit = vi.fn();
    const { result, unmount } = renderHook(() => useAutoSave<string>(commit));
    act(() => result.current.later("typed"));
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));
    unmount();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("cancel drops what is waiting: neither the pause, a flush nor an unmount sends it", () => {
    const commit = vi.fn();
    const { result, unmount } = renderHook(() => useAutoSave<string>(commit));
    act(() => result.current.later("stale"));
    act(() => result.current.cancel());
    act(() => result.current.flush());
    act(() => vi.advanceTimersByTime(5000));
    unmount();
    expect(commit).not.toHaveBeenCalled();
  });

  it("flushPendingEdits sends what is waiting and resolves once it has landed; with nothing waiting it is null", async () => {
    let land: () => void = () => {};
    const commit = vi.fn(() => new Promise<void>((resolve) => (land = resolve)));
    const { result } = renderHook(() => useAutoSave<string>(commit));
    expect(flushPendingEdits()).toBeNull();
    act(() => result.current.later("typed"));
    let settled = false;
    const sending = flushPendingEdits();
    void sending?.then(() => (settled = true));
    expect(commit).toHaveBeenCalledWith("typed");
    await Promise.resolve();
    expect(settled).toBe(false);
    land();
    await sending;
    expect(settled).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
