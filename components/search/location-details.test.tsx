import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/search/status-actions", () => ({ changeStatus: vi.fn() }));

import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";

import { LocationDetails } from "./location-details";

const result: SearchResult = {
  id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "24–34", status: "in_stock",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null,
  locations: [
    { id: "l1", productId: "p1", presentation: "folded", label: "Front table 1, A1", spanLabel: "Front table 1, A1–B2", floor: { fixtureId: "f1", faceId: "x", grid: { columns: 6, rows: 3 }, cells: { col: 0, row: 0, colSpan: 2, rowSpan: 2 } } },
    { id: "l2", productId: "p1", presentation: "folded", label: "Stockroom, bin B-12", spanLabel: "Stockroom, bin B-12", floor: null },
  ],
};

describe("LocationDetails", () => {
  it("lists every place with its presentation, and a grid for each floor place", () => {
    render(<LocationDetails result={result} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByText("Front table 1, A1–B2")).toBeInTheDocument();
    expect(screen.getAllByText("Folded")).toHaveLength(2);
    expect(screen.getByText("Stockroom, bin B-12")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Front table 1: cells A1–B2 of a 6 by 3 grid" })).toBeInTheDocument();
  });

  it("says plainly when a product has no place yet", () => {
    render(<LocationDetails result={{ ...result, locations: [] }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByText("Not placed yet. It gets a place when it goes into a planogram.")).toBeInTheDocument();
  });
});
