import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@/lib/products/queries";

import { SearchResults } from "./search-results";

const base: SearchResult = {
  id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "24–34", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid", locations: [],
};
const floor = (id: string, label: string) => ({ id, productId: "p1", presentation: "hung" as const, label, detail: "", behind: null, floor: null });

describe("SearchResults", () => {
  it("shows each product's first place and how many more", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<SearchResults results={[{ ...base, locations: [floor("l1", "Wall bay 3 · Left · Top rail"), floor("l2", "Rack 1 · Back · Center"), floor("l3", "Stockroom, bin B-12")] }]} query="pant" hasFilters={false} onOpen={onOpen} onClear={() => {}} />);
    const row = screen.getByRole("button", { name: /High-Rise Pant/ });
    expect(within(row).getByText("Wall bay 3 · Left · Top rail")).toBeInTheDocument();
    expect(row).toHaveTextContent("+2 more");
    await user.click(row);
    expect(onOpen).toHaveBeenCalledWith("p1");
  });

  it("says when a product has no place", () => {
    render(<SearchResults results={[base]} query="" hasFilters={false} onOpen={() => {}} onClear={() => {}} />);
    expect(screen.getByText("Not placed")).toBeInTheDocument();
  });

  it("offers to clear filters when nothing matches", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchResults results={[]} query="xyz" hasFilters onOpen={() => {}} onClear={onClear} />);
    expect(screen.getByText("No products match “xyz”.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("marks the product whose location is open, and only that one", () => {
    render(<SearchResults results={[base, { ...base, id: "p2", name: "Pocket Tee" }]} openId="p2" query="" hasFilters={false} onOpen={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("button", { name: /Pocket Tee/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).not.toHaveAttribute("aria-current");
  });
});
