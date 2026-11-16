import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
vi.mock("@/app/(app)/products/search-actions", () => actions);

import { searchInput } from "@/lib/products/schemas";

import { useSearch } from "./use-search";

beforeEach(() => {
  vi.useFakeTimers();
  actions.runSearch.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useSearch edges", () => {
  it("takes the shrunken total from an empty page and hides Load more without a failure", async () => {
    vi.useRealTimers();
    actions.runSearch.mockResolvedValueOnce({ results: [], total: 0 });
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [{ id: "a" }, { id: "b" }] as never[], 5));
    await act(async () => void (await result.current.showMore()));
    expect(result.current.total).toBe(2);
    expect(result.current.moreFailed).toBe(false);
  });

  it("still searches when the URL write throws", async () => {
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    actions.runSearch.mockResolvedValue({ results: [{ id: "n" }], total: 1 });
    const { result } = renderHook(() => useSearch(searchInput.parse({}), [], 0));
    act(() => result.current.update({ q: "x" }));
    await act(async () => vi.advanceTimersByTime(150));
    expect(result.current.results).toEqual([{ id: "n" }]);
    expect(result.current.isPending).toBe(false);
  });
});
