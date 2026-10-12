import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { PlacementList } from "./placement-list";

const top: PlanogramFace = { faceId: "u", fixtureId: "t", fixtureName: "Table 1", side: "top", setSide: null, label: "Top", columns: 6, rows: 3 };
const pant: GridItem = { id: "p1", faceId: "u", productId: "pant", productName: "High-Rise Pant", styleNumber: "HR-1", presentation: "folded", pieceCount: 6, col: 0, row: 0, colSpan: 2, rowSpan: 2, imageKey: null, categoryName: "Denim" };

describe("PlacementList", () => {
  it("is a card per product with its cells, presentation and pieces", () => {
    render(<PlacementList faces={[top]} items={[pant]} onSelect={vi.fn()} />);
    const card = screen.getByRole("button", { name: /High-Rise Pant/ });
    expect(card).toHaveTextContent("A1–B2");
    expect(card).toHaveTextContent("Folded · 6 pcs");
  });

  it("a tap selects; the selected card is pressed", async () => {
    const onSelect = vi.fn();
    render(<PlacementList faces={[top]} items={[pant]} selectedId="p1" onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /High-Rise Pant/ });
    expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(card);
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("keeps placements whose face left the set in their own group, with their issue", () => {
    render(<PlacementList faces={[top]} items={[]} orphans={[{ ...pant, faceId: "gone" }]} issues={new Map([["p1", "No longer in this set"]])} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No longer in this set" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).toHaveTextContent("No longer in this set");
  });

  it("says when a face is empty", () => {
    render(<PlacementList faces={[top]} items={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});
