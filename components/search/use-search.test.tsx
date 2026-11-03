import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
vi.mock("@/app/(app)/products/search-actions", () => actions);

import { searchInput } from "@/lib/products/schemas";

import { useSearch } from "./use-search";

beforeEach(() => {
  vi.useFakeTimers();
  actions.runSearch.mockReset();
  window.history.replaceState(null, "", "/products");
});
afterEach(() => vi.useRealTimers());

describe("useSearch", () => {
  it("waits 150 ms after typing, then searches once and mirrors the URL", async () => {
    actions.runSearch.mockResolvedValue({ results: [], total: 0 });
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [], 0));
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
    actions.runSearch.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve))).mockResolvedValueOnce({ results: [{ id: "new" }], total: 1 });
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [], 0));
    act(() => result.current.update({ q: "old" }));
    await act(async () => vi.advanceTimersByTime(150));
    act(() => result.current.update({ q: "new" }));
    await act(async () => vi.advanceTimersByTime(150));
    await act(async () => answerFirst({ results: [{ id: "old" }], total: 1 }));
    expect(result.current.results).toEqual([{ id: "new" }]);
  });

  it("keeps the last results and says it's offline when a search fails", async () => {
    actions.runSearch.mockRejectedValue(new TypeError("Failed to fetch"));
    const before = [{ id: "kept" }] as never[];
    const { result } = renderHook(() => useSearch(searchInput.parse({}), before, 1));
    act(() => result.current.update({ q: "x1" }));
    await act(async () => vi.advanceTimersByTime(150));
    expect(result.current.results).toBe(before);
    expect(result.current.isOffline).toBe(true);
  });

  it("keeps the last results, without blaming the connection, when the server refuses the search", async () => {
    actions.runSearch.mockResolvedValue(null);
    const before = [{ id: "kept" }] as never[];
    const { result } = renderHook(() => useSearch(searchInput.parse({}), before, 1));
    act(() => result.current.update({ q: "x1" }));
    await act(async () => vi.advanceTimersByTime(150));
    expect(result.current.results).toBe(before);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it("keeps the total the server counted", async () => {
    actions.runSearch.mockResolvedValue({ results: [], total: 47 });
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [], 0));
    act(() => result.current.update({ q: "pa" }));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(result.current.total).toBe(47);
  });

  it("shows more from where the list ends, without repeating a card", async () => {
    vi.useRealTimers();
    actions.runSearch.mockResolvedValue({ results: [{ id: "b" }, { id: "c" }], total: 3 });
    const first = [{ id: "a" }, { id: "b" }] as never[];
    const { result } = renderHook(() => useSearch(searchInput.parse({ q: "tee" }), first, 3));
    let more: Awaited<ReturnType<typeof result.current.showMore>> = null;
    await act(async () => {
      more = await result.current.showMore();
    });
    expect(actions.runSearch).toHaveBeenCalledWith(expect.objectContaining({ q: "tee", offset: 2 }));
    expect(result.current.results.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(more).toEqual({ firstId: "c", shown: 3, total: 3 });
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("starts again from the first page when the query changes", async () => {
    actions.runSearch.mockResolvedValue({ results: [], total: 0 });
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [], 0));
    act(() => result.current.update({ sort: "updated" }));
    await act(async () => vi.advanceTimersByTime(150));
    expect(actions.runSearch).toHaveBeenCalledWith(expect.objectContaining({ sort: "updated", offset: 0 }));
    expect(window.location.search).toBe("?sort=updated");
  });

  it("drops a deleted product from the list and the count", () => {
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [{ id: "a" }, { id: "b" }] as never[], 40));
    act(() => result.current.removeProduct("a"));
    expect(result.current.results.map((r) => r.id)).toEqual(["b"]);
    expect(result.current.total).toBe(39);
  });
});
