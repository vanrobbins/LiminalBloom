import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/products/status-actions", () => ({ changeStatus: vi.fn() }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { EMPTY_LAYOUT } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";

import { LocationDetails } from "./location-details";

const floor = (fixtureId: string) => ({ fixtureId, faceId: "x", grid: { columns: 12, rows: 3 }, cells: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } });
const base: SearchResult = {
  id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "24–34", status: "sold_out",
  version: 1, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid",
  locations: [
    { id: "l1", productId: "p1", presentation: "folded", label: "Front table 1 · Left", detail: "0–2 ft", behind: null, floor: floor("f1") },
    { id: "l2", productId: "p1", presentation: "hung", label: "Wall B · Right", detail: "0–2 ft", behind: null, floor: floor("f2") },
    { id: "l3", productId: "p1", presentation: "folded", label: "Stockroom, bin B-12", detail: "", behind: null, floor: null },
  ],
};
const drafter = { switches: ["view", "products.stock", "planograms.draft"] as const };
const viewer = { switches: ["view", "products.stock"] as const };

describe("LocationDetails: Quick Adjust entry (0.7.0.9 task 7a)", () => {
  it("links each floor place of a sold-out product to its adjust page with ?product=, never a bin", () => {
    render(<LocationDetails member={drafter} result={base} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByRole("link", { name: "Quick Adjust on Front table 1 · Left" })).toHaveAttribute("href", "/planograms/f1/adjust?product=p1");
    expect(screen.getByRole("link", { name: "Quick Adjust on Wall B · Right" })).toHaveAttribute("href", "/planograms/f2/adjust?product=p1");
    expect(screen.queryByRole("link", { name: /Quick Adjust on Stockroom/ })).toBeNull();
  });

  it("does the same for a product on sale", () => {
    render(<LocationDetails member={drafter} result={{ ...base, status: "on_sale" }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getAllByRole("link", { name: /^Quick Adjust on / })).toHaveLength(2);
  });

  it("offers nothing for a product in stock", () => {
    render(<LocationDetails member={drafter} result={{ ...base, status: "in_stock" }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.queryByRole("link", { name: /^Quick Adjust on / })).toBeNull();
  });

  it("offers nothing without planograms.draft", () => {
    render(<LocationDetails member={viewer} result={base} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.queryByRole("link", { name: /^Quick Adjust on / })).toBeNull();
  });

  it("counts floor places, not bins, in the sold-out line", () => {
    render(<LocationDetails member={drafter} result={base} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sold out. On 2 displays.");
  });

  const off = [{ fixtureId: "f3", fixtureName: "Wall B" }];

  it("says which fixture a published Quick Adjust took it off, with an Adjust link for drafters", () => {
    render(<LocationDetails member={drafter} result={{ ...base, locations: [], adjustedOff: off }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByText("Off Wall B for a Quick Adjust")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quick Adjust on Wall B" })).toHaveAttribute("href", "/planograms/f3/adjust?product=p1");
    expect(screen.queryByText(/Not placed yet/)).toBeNull();
  });

  it("shows the Off line without the link when the member cannot draft", () => {
    render(<LocationDetails member={viewer} result={{ ...base, locations: [], adjustedOff: off }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByText("Off Wall B for a Quick Adjust")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Quick Adjust on / })).toBeNull();
  });

  it("keeps the other places listed beside the Off line, and the link even once restocked", () => {
    render(<LocationDetails member={drafter} result={{ ...base, status: "in_stock", adjustedOff: off }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.getByText("Off Wall B for a Quick Adjust")).toBeInTheDocument();
    expect(screen.getByText("Front table 1 · Left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quick Adjust on Wall B" })).toBeInTheDocument();
  });

  it("has no Off line when nothing was adjusted off, and still says Not placed yet", () => {
    render(<LocationDetails member={drafter} result={{ ...base, locations: [], adjustedOff: [] }} layout={EMPTY_LAYOUT} onChanged={() => {}} />);
    expect(screen.queryByText(/for a Quick Adjust/)).toBeNull();
    expect(screen.getByText(/Not placed yet/)).toBeInTheDocument();
  });
});
