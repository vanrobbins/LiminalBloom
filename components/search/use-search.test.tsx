import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
vi.mock("@/app/(app)/search/actions", () => actions);

import { searchInput } from "@/lib/products/schemas";

import { useSearch } from "./use-search";

beforeEach(() => {
  vi.useFakeTimers();
  actions.runSearch.mockReset();
  window.history.replaceState(null, "", "/search");
});
afterEach(() => vi.useRealTimers());

describe("useSearch", () => {
  it("waits 150 ms after typing, then searches once and mirrors the URL", async () => {
    actions.runSearch.mockResolvedValue([]);
    const { result } = renderHook(() => useSearch(searchInput.parse({}), []));
    act(() => result.current.update({ q: "p" }));
    act(() => result.current.update({ q: "pa" }));
    act(() => result.current.update({ q: "pan" }));
    expect(actions.runSearch).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(150));
    expect(actions.runSearch).toHaveBeenCalledTimes(1);
    expect(actions.runSearch).toHaveBeenCalledWith(expect.objectContaining({ q: "pan" }));
    expect(window.location.search).toBe("?q=pan");
  });

  it("ignores a slow answer that a newer search overtook", async () => {
    let answerFirst: (value: unknown) => void = () => {};
    actions.runSearch.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve))).mockResolvedValueOnce([{ id: "new" }]);
    const { result } = renderHook(() => useSearch(searchInput.parse({}), []));
    act(() => result.current.update({ q: "old" }));
    await act(async () => vi.advanceTimersByTime(150));
    act(() => result.current.update({ q: "new" }));
    await act(async () => vi.advanceTimersByTime(150));
    await act(async () => answerFirst([{ id: "old" }]));
    expect(result.current.results).toEqual([{ id: "new" }]);
  });

  it("keeps the last results and says it's offline when a search fails", async () => {
    actions.runSearch.mockRejectedValue(new TypeError("Failed to fetch"));
    const before = [{ id: "kept" }] as never[];
    const { result } = renderHook(() => useSearch(searchInput.parse({}), before));
    act(() => result.current.update({ q: "x1" }));
    await act(async () => vi.advanceTimersByTime(150));
    expect(result.current.results).toBe(before);
    expect(result.current.isOffline).toBe(true);
  });

  it("keeps the last results, without blaming the connection, when the server refuses the search", async () => {
    actions.runSearch.mockResolvedValue(null);
    const before = [{ id: "kept" }] as never[];
    const { result } = renderHook(() => useSearch(searchInput.parse({}), before));
    act(() => result.current.update({ q: "x1" }));
    await act(async () => vi.advanceTimersByTime(150));
    expect(result.current.results).toBe(before);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isPending).toBe(false);
  });
});
