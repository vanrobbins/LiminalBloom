import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  render(<SearchScreen initial={searchInput.parse({ q: "p" })} initialResults={[pant, tee]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} {...overrides} />);

describe("SearchScreen result rendering", () => {
  it("shows each result with its style number, and the count", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pocket Tee/ })).toBeInTheDocument();
    expect(screen.getByText(/p1-01/)).toBeInTheDocument();
    expect(screen.getByText("2 products")).toBeInTheDocument();
  });

  it("says how many of how many when Search shows only the first page", () => {
    renderScreen({ initialTotal: 47 });
    expect(screen.getByText("2 of 47 products")).toBeInTheDocument();
  });

  it("shows singular product for count of 1", () => {
    render(<SearchScreen initial={searchInput.parse({ q: "p" })} initialResults={[pant]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);
    expect(screen.getByText("1 product")).toBeInTheDocument();
  });

  it("opens result detail panel when clicked, with a link to edit the product", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /High-Rise Pant/ }));
    const panel = screen.getByRole("complementary", { name: /High-Rise Pant/ });
    expect(within(panel).getByRole("link", { name: "Edit product" })).toHaveAttribute("href", "/products/p1");
  });
});

describe("SearchScreen title and actions", () => {
  it("is called Products and offers Categories and Add product", () => {
    renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add product" })[0]).toHaveAttribute("href", "/products/new");
    expect(screen.getByRole("link", { name: "Categories" })).toHaveAttribute("href", "/products/categories");
  });
});

describe("SearchScreen Show more", () => {
  it("shows more under the cards, then moves focus to the first new card and says how many", async () => {
    const user = userEvent.setup();
    const ink = product("p3", "Ink Jacket");
    actions.runSearch.mockResolvedValueOnce({ results: [ink], total: 3 });
    renderScreen({ initialTotal: 3 });
    expect(screen.getByText("2 of 3 products")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(actions.runSearch).toHaveBeenCalledWith(expect.objectContaining({ offset: 2 }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /Ink Jacket/ })).toHaveFocus());
    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("3 products")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("has no Show more when everything is shown", () => {
    renderScreen();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});

describe("SearchScreen card menu", () => {
  it("gives each card a ⋯ menu only from 1024 px", () => {
    const { unmount } = renderScreen();
    expect(screen.queryByRole("button", { name: "More for High-Rise Pant" })).toBeNull();
    unmount();
    mediaQuery.useMediaQuery.mockImplementation((query: string) => query === "(min-width: 1024px)");
    renderScreen();
    expect(screen.getByRole("button", { name: "More for High-Rise Pant" })).toBeInTheDocument();
  });
});

describe("SearchScreen empty state", () => {
  it("tells a store with no products how to start", () => {
    render(<SearchScreen initial={searchInput.parse({})} initialResults={[]} initialTotal={0} isCatalogEmpty categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);
    expect(screen.getByText("No products yet. Add the first one, or set up categories.")).toBeInTheDocument();
  });

  it("shows empty results message when no products found", () => {
    render(<SearchScreen initial={searchInput.parse({ q: "xyz" })} initialResults={[]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);
    expect(screen.getByText("0 products")).toBeInTheDocument();
  });

  it("renders all-products view with no query", () => {
    render(<SearchScreen initial={searchInput.parse({ q: "" })} initialResults={[pant, tee]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);
    expect(screen.getByText("2 products")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).toBeInTheDocument();
  });
});

describe("SearchScreen focus and panel management", () => {
  it("moves focus into the panel on desktop", async () => {
    const user = userEvent.setup();
    renderScreen();
    const row = screen.getByRole("button", { name: /Pocket Tee/ });
    await user.click(row);
    expect(screen.getByRole("heading", { name: "Pocket Tee" })).toHaveFocus();
  });

  it("returns focus to row on close", async () => {
    const user = userEvent.setup();
    renderScreen();
    const row = screen.getByRole("button", { name: /Pocket Tee/ });
    await user.click(row);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(row).toHaveFocus();
  });

  it("marks the open result with aria-current, and clears it when the panel closes", async () => {
    const user = userEvent.setup();
    renderScreen();
    const row = screen.getByRole("button", { name: /Pocket Tee/ });
    await user.click(row);
    expect(row).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(row).not.toHaveAttribute("aria-current");
  });

  it("forgets the open product when search leaves it out", async () => {
    const user = userEvent.setup();
    actions.runSearch.mockResolvedValueOnce({ results: [pant], total: 1 }).mockResolvedValueOnce({ results: [pant, tee], total: 2 });
    renderScreen();
    await user.click(screen.getByRole("button", { name: /Pocket Tee/ }));
    const box = screen.getByRole("searchbox", { name: "Search products" });
    await user.type(box, "a");
    await vi.waitFor(() => expect(screen.queryByRole("complementary", { name: "Pocket Tee" })).not.toBeInTheDocument());

    // The product comes back in a later search: it shows in the list, but its panel stays shut.
    await user.type(box, "n");
    await screen.findByRole("button", { name: /Pocket Tee/ });
    await act(async () => {});
    expect(screen.queryByRole("complementary", { name: "Pocket Tee" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pocket Tee/ })).not.toHaveAttribute("aria-current");
  });

  it("on tablet and desktop, opening a card moves focus into the panel, and Escape brings it back (P3.4)", async () => {
    const user = userEvent.setup();
    renderScreen();
    const card = screen.getByRole("button", { name: /High-Rise Pant/ });
    await user.click(card);
    expect(screen.getByRole("heading", { level: 2, name: "High-Rise Pant" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "High-Rise Pant" })).toBeNull();
    expect(card).toHaveFocus();
  });
});
