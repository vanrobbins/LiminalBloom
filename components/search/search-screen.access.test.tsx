// What the Products screen shows for a role that cannot edit products (spec 0.7 §4.7).
// Hiding is a courtesy; the server refuses the same actions. Split from search-screen.test.tsx.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mediaQuery = vi.hoisted(() => ({ PHONE_QUERY: "(max-width: 767px)", useMediaQuery: vi.fn((query: string) => (void query, false)) }));
vi.mock("@/app/(app)/products/search-actions", () => ({ runSearch: vi.fn() }));
vi.mock("@/components/store-map/use-media-query", () => mediaQuery);
vi.mock("./location-details", () => ({ LocationDetails: () => <p>Where it is</p> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/products" }));
vi.mock("@/app/(app)/products/actions", () => ({ removeProduct: vi.fn() }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

import { SearchScreen } from "./search-screen";

const pant: SearchResult = {
  id: "p1", name: "High-Rise Pant", styleNumber: "p1-01", color: "Black", sizeRange: "", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid", locations: [],
};

const show = (member: { switches: readonly import("@/lib/access/switches").Switch[] }) =>
  render(<SearchScreen member={member} initial={searchInput.parse({ q: "p" })} initialResults={[pant]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);

beforeEach(() => mediaQuery.useMediaQuery.mockReturnValue(false));

describe("SearchScreen for a role that cannot edit products", () => {
  const viewer = { switches: ["view", "products.stock"] } as const;

  it("has no Add product, Categories or More product actions", () => {
    show(viewer);
    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add product" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Categories" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More product actions" })).toBeNull();
  });

  it("opens a product's details without the Edit product link", async () => {
    show(viewer);
    await userEvent.setup().click(screen.getByRole("button", { name: /High-Rise Pant/ }));
    const panel = screen.getByRole("complementary", { name: /High-Rise Pant/ });
    expect(within(panel).queryByRole("link", { name: "Edit product" })).toBeNull();
  });

  it("has no Edit or Delete menu on a card, even at desktop width", () => {
    mediaQuery.useMediaQuery.mockReturnValue(true);
    show(viewer);
    expect(screen.queryByRole("button", { name: /^More for / })).toBeNull();
  });

  it("with products.edit shows all of them (the control)", async () => {
    mediaQuery.useMediaQuery.mockReturnValue(true);
    show({ switches: [...EVERYTHING.switches] });
    expect(screen.getAllByRole("link", { name: "Add product" })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More for High-Rise Pant" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /^High-Rise Pant/ }));
    expect(screen.getByRole("link", { name: "Edit product" })).toBeInTheDocument();
  });
});
