import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ runSearch: vi.fn() }));
vi.mock("@/app/(app)/products/search-actions", () => actions);
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "(max-width: 767px)", useMediaQuery: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/products" }));
vi.mock("@/app/(app)/products/actions", () => ({ removeProduct: vi.fn() }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

import { SearchScreen } from "./search-screen";

const product = (id: string): SearchResult => ({
  id, name: `Item ${id}`, styleNumber: `${id}-01`, color: "Black", sizeRange: "", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid", locations: [],
});

beforeEach(() => actions.runSearch.mockReset());

describe("SearchScreen announcements", () => {
  it("keeps the visible count line silent and announces a search's answer once, from the single announcer", async () => {
    actions.runSearch.mockResolvedValue({ results: [product("p9")], total: 1 });
    const user = userEvent.setup();
    render(<SearchScreen member={EVERYTHING} initial={searchInput.parse({})} initialResults={[product("p1")]} categories={[]} colors={[]} layout={EMPTY_LAYOUT} />);
    const visible = screen.getByText("1 product").closest("p");
    expect(visible).not.toHaveAttribute("aria-live");
    await act(async () => {
      await user.type(screen.getByRole("searchbox", { name: "Search products" }), "i");
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    const live = document.querySelectorAll("[aria-live]");
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveTextContent("1 product");
  });
});
