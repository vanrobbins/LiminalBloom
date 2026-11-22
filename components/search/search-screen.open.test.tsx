// Entry param /products?open= (0.7.0.8): the screen starts with that product's
// location sheet or side panel open; closing drops the param; typing never writes it.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
const mediaQuery = vi.hoisted(() => ({ PHONE_QUERY: "(max-width: 767px)", useMediaQuery: vi.fn((query: string) => (void query, false)) }));
vi.mock("@/app/(app)/products/search-actions", () => actions);
vi.mock("@/components/store-map/use-media-query", () => mediaQuery);
vi.mock("./location-details", () => ({ LocationDetails: () => <p>Where it is</p> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/products" }));
vi.mock("@/app/(app)/products/actions", () => ({ removeProduct: vi.fn() }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

import { SearchScreen } from "./search-screen";

const product = (id: string, name: string): SearchResult => ({
  id, name, styleNumber: `${id}-01`, color: "Black", sizeRange: "", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid", locations: [],
});
const pant = product("p1", "High-Rise Pant");
const tee = product("p2", "Pocket Tee");
const here = () => window.location.pathname + window.location.search;

beforeEach(() => {
  actions.runSearch.mockReset();
  actions.runSearch.mockResolvedValue({ results: [pant, tee], total: 2 });
  mediaQuery.useMediaQuery.mockReturnValue(false);
  window.history.replaceState(null, "", "/products?q=p&open=p2");
});

const renderScreen = (initialOpenId?: string) =>
  render(<SearchScreen member={EVERYTHING} initial={searchInput.parse({ q: "p" })} initialResults={[pant, tee]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} initialOpenId={initialOpenId} />);

describe("SearchScreen initialOpenId", () => {
  it("starts with that product's side panel open", () => {
    renderScreen("p2");
    expect(screen.getByRole("complementary", { name: /Pocket Tee/ })).toBeInTheDocument();
  });

  it("starts with the phone sheet open on a phone", () => {
    mediaQuery.useMediaQuery.mockImplementation((query: string) => query === "(max-width: 767px)");
    renderScreen("p2");
    expect(screen.getByRole("dialog", { name: /Pocket Tee/ })).toBeInTheDocument();
  });

  it("opens nothing when the id is not among the results", () => {
    renderScreen("p9");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("opens nothing without it", () => {
    renderScreen();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("closing replaces the address without open and keeps the query", async () => {
    renderScreen("p2");
    await userEvent.setup().click(within(screen.getByRole("complementary", { name: /Pocket Tee/ })).getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(here()).toBe("/products?q=p");
  });

  it("typing drops open from the address and never writes it", async () => {
    renderScreen("p2");
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search products" }), "a");
    expect(here()).toBe("/products?q=pa");
  });
});
