import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
const mediaQuery = vi.hoisted(() => ({ PHONE_QUERY: "(max-width: 767px)", useMediaQuery: vi.fn((query: string) => (void query, false)) }));
vi.mock("@/app/(app)/products/search-actions", () => actions);
vi.mock("@/components/store-map/use-media-query", () => mediaQuery);
vi.mock("./location-details", () => ({ LocationDetails: () => <p>Where it is</p> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/products" }));
vi.mock("@/app/(app)/products/actions", () => ({ removeProduct: vi.fn() }));

import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

import { EVERYTHING } from "@/lib/access/test-guard";
import { SearchScreen } from "./search-screen";

const product = (id: string, name: string, overrides?: Partial<SearchResult>): SearchResult => ({
  id, name, styleNumber: `${id}-01`, color: "Black", sizeRange: "", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid", locations: [],
  ...overrides,
});
const pant = product("p1", "High-Rise Pant");
const tee = product("p2", "Pocket Tee");

beforeEach(() => {
  actions.runSearch.mockReset();
  mediaQuery.useMediaQuery.mockReturnValue(false);
  window.history.replaceState(null, "", "/products");
});

const renderScreen = (overrides?: Partial<Parameters<typeof SearchScreen>[0]>) =>
  render(<SearchScreen member={EVERYTHING} initial={searchInput.parse({ q: "p" })} initialResults={[pant, tee]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} {...overrides} />);

describe("SearchScreen Load more", () => {
  // jsdom has no IntersectionObserver: this one reports a sighting when the test says so.
  type Entries = { isIntersecting: boolean }[];
  const watching: { callback: (entries: Entries) => void; disconnected: boolean }[] = [];
  beforeEach(() => {
    watching.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry: { callback: (entries: Entries) => void; disconnected: boolean };
        constructor(callback: (entries: Entries) => void) {
          this.entry = { callback, disconnected: false };
          watching.push(this.entry);
        }
        observe() {}
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  const liveObservers = () => watching.filter((w) => !w.disconnected);
  const scrollToEnd = () => act(() => liveObservers().forEach((w) => w.callback([{ isIntersecting: true }])));

  it("loads more under the cards, then moves focus to the first new card and says how many", async () => {
    const user = userEvent.setup();
    const ink = product("p3", "Ink Jacket");
    actions.runSearch.mockResolvedValueOnce({ results: [ink], total: 3 });
    renderScreen({ initialTotal: 3 });
    expect(screen.getByText("2 of 3 products")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(actions.runSearch).toHaveBeenCalledWith(expect.objectContaining({ offset: 2 }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /Ink Jacket/ })).toHaveFocus());
    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("3 products")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("has no Load more, and watches nothing, when everything is shown", () => {
    renderScreen();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(watching).toHaveLength(0);
  });

  it("loads the next page by itself when the end scrolls into view, without taking focus or announcing", async () => {
    actions.runSearch.mockResolvedValueOnce({ results: [product("p3", "Ink Jacket")], total: 3 });
    renderScreen({ initialTotal: 3 });
    expect(liveObservers()).toHaveLength(1);
    scrollToEnd();
    expect(actions.runSearch).toHaveBeenCalledWith(expect.objectContaining({ offset: 2 }));
    expect(await screen.findByText("3 products")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ink Jacket/ })).not.toHaveFocus();
    expect(screen.queryByText(/Showing/)).toBeNull();
    expect(liveObservers()).toHaveLength(0);
  });

  it("disables Load more, and loads nothing, while a search is pending", async () => {
    const user = userEvent.setup();
    let finish: (page: unknown) => void = () => {};
    actions.runSearch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderScreen({ initialTotal: 5 });
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "x");
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
    expect(liveObservers()).toHaveLength(0);
    await vi.waitFor(() => expect(actions.runSearch).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Searching…")).toBeInTheDocument();
    await act(async () => finish({ results: [pant, tee], total: 5 }));
    expect(screen.getAllByText("2 of 5 products")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
  });

  it("does not load a second page while one is on its way", async () => {
    let finish: (page: unknown) => void = () => {};
    actions.runSearch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderScreen({ initialTotal: 5 });
    scrollToEnd();
    expect(liveObservers()).toHaveLength(0);
    scrollToEnd();
    expect(actions.runSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Loading more…" })).toBeInTheDocument();
    await act(async () => finish({ results: [product("p3", "Ink Jacket")], total: 5 }));
  });

  it("says a failed load inline, stops auto-loading and keeps the button to try again", async () => {
    const user = userEvent.setup();
    actions.runSearch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderScreen({ initialTotal: 3 });
    scrollToEnd();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load more. Try again.");
    expect(liveObservers()).toHaveLength(0);
    actions.runSearch.mockResolvedValueOnce({ results: [product("p3", "Ink Jacket")], total: 3 });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Showing 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disconnects its observer when the screen goes", () => {
    const { unmount } = renderScreen({ initialTotal: 3 });
    expect(liveObservers()).toHaveLength(1);
    unmount();
    expect(liveObservers()).toHaveLength(0);
  });
});
