import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePaletteData } from "./use-palette-data";

const index = { planograms: [{ fixtureId: "f1", name: "Rack 1", zoneName: "Men", state: "Draft" }], zones: [] };
const found = { products: [{ id: "p1", name: "Navy Tee", styleNumber: "NT-1", status: "in_stock", place: null, more: 0 }], total: 1 };

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));
const isProducts = (url: string) => String(url).includes("products");

type Props = { open: boolean; query: string; storeId: string };
const setup = (initial: Props, onUnauthorized = vi.fn()) => ({
  onUnauthorized,
  ...renderHook((props: Props) => usePaletteData({ ...props, onUnauthorized }), { initialProps: initial }),
});
const settle = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => (isProducts(url) ? reply(found) : reply(index)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("usePaletteData: the index", () => {
  it("loads on open, not while closed, and again on every open", async () => {
    const { result, rerender } = setup({ open: false, query: "", storeId: "s1" });
    await settle(10);
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ open: true, query: "", storeId: "s1" });
    await settle(10);
    expect(result.current.index).toEqual(index);
    rerender({ open: false, query: "", storeId: "s1" });
    rerender({ open: true, query: "", storeId: "s1" });
    expect(result.current.index).toEqual(index); // the last copy shows meanwhile
    await settle(10);
    expect(urls().filter((u) => u === "/api/palette")).toHaveLength(2);
  });

  it("drops the copy when the store changes", async () => {
    const { result, rerender } = setup({ open: true, query: "", storeId: "s1" });
    await settle(10);
    fetchMock.mockImplementation(() => new Promise(() => {}));
    rerender({ open: true, query: "", storeId: "s2" });
    expect(result.current.index).toBeNull();
  });

  it("a 401 calls onUnauthorized", async () => {
    fetchMock.mockImplementation(() => reply({}, 401));
    const { onUnauthorized } = setup({ open: true, query: "", storeId: "s1" });
    await settle(10);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});

describe("usePaletteData: products", () => {
  it("waits for the debounce, then asks once with the normalized query", async () => {
    const { result } = setup({ open: true, query: "  Navy  TEE ", storeId: "s1" });
    await settle(100);
    expect(urls().some(isProducts)).toBe(false);
    expect(result.current.state).toBe("loading");
    await settle(100);
    expect(urls()).toContain("/api/palette/products?q=navy+tee");
    expect(result.current.state).toBe("ready");
    expect(result.current.products).toEqual(found);
  });

  it("makes no request for a query that is not text", async () => {
    const { result } = setup({ open: true, query: "a", storeId: "s1" });
    await settle(500);
    expect(urls().some(isProducts)).toBe(false);
    expect(result.current.state).toBe("idle");
  });

  it("aborts the earlier request when the query changes", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (!isProducts(url)) return reply(index);
      signals.push(init?.signal as AbortSignal);
      return new Promise(() => {});
    });
    const { rerender } = setup({ open: true, query: "na", storeId: "s1" });
    await settle(200);
    rerender({ open: true, query: "nav", storeId: "s1" });
    expect(signals[0].aborted).toBe(true);
  });

  it("shows the searching row only after 300 ms", async () => {
    fetchMock.mockImplementation((url: string) => (isProducts(url) ? new Promise(() => {}) : reply(index)));
    const { result } = setup({ open: true, query: "navy", storeId: "s1" });
    await settle(250);
    expect(result.current.state).toBe("loading");
    expect(result.current.searching).toBe(false);
    await settle(100);
    expect(result.current.searching).toBe(true);
  });

  it("a failed search is an error state, not a thrown one", async () => {
    fetchMock.mockImplementation((url: string) => (isProducts(url) ? Promise.reject(new TypeError("offline")) : reply(index)));
    const { result } = setup({ open: true, query: "navy", storeId: "s1" });
    await settle(300);
    expect(result.current.state).toBe("error");
    expect(result.current.products).toBeNull();
  });

  it("a malformed answer is an error", async () => {
    fetchMock.mockImplementation((url: string) => (isProducts(url) ? reply({ nope: 1 }) : reply(index)));
    const { result } = setup({ open: true, query: "navy", storeId: "s1" });
    await settle(300);
    expect(result.current.state).toBe("error");
  });

  it("a 401 calls onUnauthorized", async () => {
    fetchMock.mockImplementation((url: string) => (isProducts(url) ? reply({}, 401) : reply(index)));
    const { onUnauthorized } = setup({ open: true, query: "navy", storeId: "s1" });
    await settle(300);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("the old answer is gone when the query changes", async () => {
    const { result, rerender } = setup({ open: true, query: "navy", storeId: "s1" });
    await settle(300);
    expect(result.current.products).toEqual(found);
    rerender({ open: true, query: "navy t", storeId: "s1" });
    expect(result.current.products).toBeNull();
    expect(result.current.state).toBe("loading");
  });
});
