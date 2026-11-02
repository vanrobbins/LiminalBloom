import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@/lib/products/queries";

import { SearchCard } from "./search-card";

const where = (id: string, label: string, detail = "") => ({ id, productId: "p1", presentation: "hung" as const, label, detail, floor: null });
const result: SearchResult = {
  id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "", status: "in_stock", version: 1,
  categoryId: "c", categoryName: "Pants", imageKey: null,
  locations: [where("l1", "Wall bay 3 · Left · Top rail", "0–2 ft from left · level 1 of 4"), where("l2", "Stockroom, bin B-12")],
};

describe("SearchCard", () => {
  it("puts where it goes first and large, then how, and how many more places", () => {
    render(<SearchCard result={result} isOpen={false} onOpen={vi.fn()} />);
    const card = screen.getByRole("button", { name: /High-Rise Pant/ });
    const place = screen.getByText("Wall bay 3 · Left · Top rail");
    expect(place).toHaveClass("text-lg");
    expect(card).toHaveTextContent("Hung · 0–2 ft from left · level 1 of 4 · +1 more");
    expect(card).toHaveTextContent("In stock");
  });

  it("says when a product has no place yet", () => {
    render(<SearchCard result={{ ...result, locations: [] }} isOpen={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Not placed")).toBeInTheDocument();
  });

  it("opens the location sheet, and marks itself while open", async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<SearchCard result={result} isOpen={false} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /High-Rise Pant/ }));
    expect(onOpen).toHaveBeenCalledWith("p1");
    rerender(<SearchCard result={result} isOpen onOpen={onOpen} />);
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).toHaveAttribute("aria-current", "true");
  });
});
