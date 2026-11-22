import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace, SnapshotEntry } from "@/lib/planograms/types";

import { itemsFromDraft, itemsFromSnapshot } from "./grid-items";
import { PlanogramGrid } from "./planogram-grid";

// The Published view marks sold-out and on-sale tiles (0.7.0.9 spec §5.2); the monthly draft's tiles never carry a status.
const face: PlanogramFace = { faceId: "f", fixtureId: "fx", fixtureName: "Wall bay 3", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 4 };
const entry = (productId: string, productName: string, col: number): SnapshotEntry => ({
  faceId: "f", faceLabel: "Front", side: "front", fixtureId: "fx", fixtureName: "Wall bay 3", productId, productName, styleNumber: "S", presentation: "folded", col, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 4, depth: 0,
});
const entries = [entry("a", "Straight jean", 0), entry("b", "Slim jean", 3), entry("c", "Crop jean", 6)];
const looks = {
  a: { imageKey: null, categoryName: "Jeans", status: "sold_out" as const },
  b: { imageKey: null, categoryName: "Jeans", status: "on_sale" as const },
  c: { imageKey: null, categoryName: "Jeans", status: "in_stock" as const },
};
const grid = (items: ReturnType<typeof itemsFromSnapshot>) => render(<PlanogramGrid layout={singleBlock(face)} items={items} label="Wall bay 3, Front" onSelect={vi.fn()} />);
const badges = (container: HTMLElement) => container.querySelectorAll("[data-status-badge]");

describe("status marks on the Published view", () => {
  it("names a sold-out and an on-sale tile so, with a badge each, and leaves an in-stock one alone", () => {
    const { container } = grid(itemsFromSnapshot(entries, looks, true));
    expect(screen.getByRole("button", { name: /^Straight jean, sold out, / })).toHaveAttribute("data-status", "sold_out");
    expect(screen.getByRole("button", { name: /^Slim jean, on sale, / })).toHaveAttribute("data-status", "on_sale");
    expect(screen.getByRole("button", { name: /^Crop jean, (?!sold out|on sale)/ })).not.toHaveAttribute("data-status");
    expect(badges(container)).toHaveLength(2);
  });

  it("marks nothing when the caller did not ask (a past version, the map)", () => {
    const { container } = grid(itemsFromSnapshot(entries, looks));
    expect(badges(container)).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^Straight jean, (?!sold out)/ })).not.toHaveAttribute("data-status");
  });

  it("the monthly draft's tiles carry no status, whatever the product's", () => {
    const placements = entries.map((e, i) => ({ ...e, id: `d${i}`, version: 1, depth: 0, imageKey: null, categoryName: "Jeans" }));
    const { container } = grid(itemsFromDraft(placements));
    expect(badges(container)).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^Straight jean, (?!sold out)/ })).not.toHaveAttribute("data-status");
  });
});
