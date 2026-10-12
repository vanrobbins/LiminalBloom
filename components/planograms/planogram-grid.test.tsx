import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { PlanogramGrid } from "./planogram-grid";

const face = (faceId: string, setSide: PlanogramFace["setSide"], rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "Front Table set", side: "top", setSide, label: faceId === "u" ? "Upper" : "Front table", columns: 6, rows,
});
const pant: GridItem = { id: "p1", faceId: "u", productId: "pant", productName: "High-Rise Pant", styleNumber: "HR-1", presentation: "folded", pieceCount: 6, col: 0, row: 0, colSpan: 2, rowSpan: 2, imageKey: null, categoryName: "Denim" };

describe("PlanogramGrid", () => {
  it("names itself and gives each placement a button naming product, cells and stock", () => {
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="Front Table set, Top" onSelect={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Front Table set, Top: 1 product" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "High-Rise Pant, A1–B2, Folded 6" })).toBeInTheDocument();
  });

  it("a tap on a tile selects it", () => {
    const onSelect = vi.fn();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /High-Rise Pant/ }));
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("marks the selection as pressed, and the highlighted product", () => {
    const other = { ...pant, id: "p2", productId: "other", productName: "Tee", col: 3 };
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, other]} label="T" selectedId="p1" highlightProductId="other" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-placement="p2"]')).toHaveAttribute("data-marked");
  });

  it("names an issue in the tile's name", () => {
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" issues={new Map([["p1", "Off the edge of the face"]])} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "High-Rise Pant, A1–B2, Folded 6. Off the edge of the face" })).toBeInTheDocument();
  });

  it("a tap on a lower table's open cell picks that table's face", () => {
    const onEmptyCell = vi.fn();
    const { container } = render(<PlanogramGrid layout={setBlocks([face("u", null, 3), face("f", "front", 2)])} items={[pant]} label="Set" onSelect={vi.fn()} onEmptyCell={onEmptyCell} />);
    const cell = container.querySelector('[data-cell="f:1:0"]');
    expect(cell).not.toBeNull();
    if (cell) fireEvent.click(cell);
    expect(onEmptyCell).toHaveBeenCalledWith({ faceId: "f", col: 1, row: 0 });
  });

  it("counts only the products on faces it draws", () => {
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, { ...pant, id: "p3", faceId: "elsewhere" }]} label="T" onSelect={vi.fn()} />);
    expect(screen.getByRole("region", { name: "T: 1 product" })).toBeInTheDocument();
  });

  it("draws a tile for a product with no look (deleted since publish) (Review Focus 2)", () => {
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[{ ...pant, categoryName: "" }]} label="T" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /High-Rise Pant/ })).toBeInTheDocument();
  });

  it("reports a touch swipe, which arrives even when the browser scrolls the grid, and ignores a tap", () => {
    const onSwipe = vi.fn();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" onSelect={vi.fn()} onSwipe={onSwipe} />);
    const surface = screen.getByRole("region", { name: "T: 1 product" }).firstElementChild!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 10, clientY: 5 }] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [{ clientX: 10, clientY: 5 }] });
    expect(onSwipe).not.toHaveBeenCalled();
    fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 5 }] });
    // The browser panning the grid sends pointercancel; the touch still ends.
    fireEvent.pointerCancel(surface, { pointerType: "touch" });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [{ clientX: 100, clientY: 15 }] });
    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe).toHaveBeenCalledWith({ dx: -100, dy: 10, edges: { left: false, right: false } });
  });

  it("reports a mouse drag, but not a click, and never counts a touch twice", () => {
    const onSwipe = vi.fn();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" onSelect={vi.fn()} onSwipe={onSwipe} />);
    const surface = screen.getByRole("region", { name: "T: 1 product" }).firstElementChild!;
    fireEvent.pointerDown(surface, { pointerType: "mouse", clientX: 50, clientY: 0 });
    fireEvent.pointerUp(surface, { pointerType: "mouse", clientX: 52, clientY: 0 });
    expect(onSwipe).not.toHaveBeenCalled();
    fireEvent.pointerDown(surface, { pointerType: "mouse", clientX: 50, clientY: 0 });
    fireEvent.pointerUp(surface, { pointerType: "mouse", clientX: 150, clientY: 0 });
    expect(onSwipe).toHaveBeenCalledWith({ dx: 100, dy: 0, edges: { left: false, right: false } });
    onSwipe.mockClear();
    fireEvent.pointerDown(surface, { pointerType: "touch", clientX: 50, clientY: 0 });
    fireEvent.pointerUp(surface, { pointerType: "touch", clientX: 150, clientY: 0 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("a two-finger pinch is not a swipe", () => {
    const onSwipe = vi.fn();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" onSelect={vi.fn()} onSwipe={onSwipe} />);
    const surface = screen.getByRole("region", { name: "T: 1 product" }).firstElementChild!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 5 }] });
    fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 5 }, { clientX: 260, clientY: 5 }] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [{ clientX: 60, clientY: 5 }] });
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
