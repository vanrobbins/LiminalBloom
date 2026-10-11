import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
const mediaQuery = vi.hoisted(() => ({ PHONE_QUERY: "(max-width: 767px)", useMediaQuery: vi.fn(() => false) }));
vi.mock("@/app/(app)/search/actions", () => actions);
vi.mock("@/components/store-map/use-media-query", () => mediaQuery);
vi.mock("./location-details", () => ({ LocationDetails: () => <p>Where it is</p> }));

import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

import { SearchScreen } from "./search-screen";

const product = (id: string, name: string, overrides?: Partial<SearchResult>): SearchResult => ({
  id, name, styleNumber: `${id}-01`, color: "Black", sizeRange: "", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, locations: [],
  ...overrides,
});
const pant = product("p1", "High-Rise Pant");
const tee = product("p2", "Pocket Tee");

beforeEach(() => {
  actions.runSearch.mockReset();
  mediaQuery.useMediaQuery.mockReturnValue(false);
  window.history.replaceState(null, "", "/search");
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

  it("shows singular product for count of 1", () => {
    render(<SearchScreen initial={searchInput.parse({ q: "p" })} initialResults={[pant]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);
    expect(screen.getByText("1 product")).toBeInTheDocument();
  });

  it("opens result detail panel when clicked", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /High-Rise Pant/ }));
    expect(screen.getByRole("complementary", { name: /High-Rise Pant/ })).toBeInTheDocument();
  });
});

describe("SearchScreen empty state", () => {
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
    actions.runSearch.mockResolvedValueOnce([pant]).mockResolvedValueOnce([pant, tee]);
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
});
