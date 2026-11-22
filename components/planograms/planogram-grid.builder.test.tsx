import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { PlanogramGrid, type GridBuilder } from "./planogram-grid";

const face = (faceId: string, setSide: PlanogramFace["setSide"], rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "Front Table set", fixtureType: "table", side: "top", setSide, label: faceId === "u" ? "Upper" : "Front table", columns: 12, rows,
});
const pant: GridItem = { id: "p1", faceId: "u", productId: "pant", productName: "High-Rise Pant", styleNumber: "HR-1", presentation: "folded", pieceCount: 6, col: 0, row: 0, colSpan: 4, rowSpan: 2, imageKey: null, categoryName: "Denim" };

const fieldsOf = (i: GridItem) => ({ faceId: i.faceId, presentation: i.presentation, col: i.col, row: i.row, colSpan: i.colSpan, rowSpan: i.rowSpan, pieceCount: i.pieceCount });
const builderWith = (over: Partial<GridBuilder> = {}): GridBuilder => ({
  canMove: true, check: () => null, onCommit: vi.fn(() => Promise.resolve()), onRefused: vi.fn(), onKey: vi.fn(), onReorder: vi.fn(), onEmpty: vi.fn(), onDragging: vi.fn(), ...over,
});
// 12 half-foot units across, drawn 240 px wide: 20 px a unit.
const sized = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, toJSON: () => ({}) } as DOMRect);

describe("PlanogramGrid as the builder's surface", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws no cell lines at rest; a standing face shows its levels", () => {
    const wall: PlanogramFace = { ...face("u", null, 4), fixtureType: "wall_bay", side: "front" };
    const { container } = render(<PlanogramGrid layout={singleBlock(wall)} items={[pant]} label="T" onSelect={vi.fn()} />);
    expect(container.querySelectorAll("[data-cell]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-level-rule]")).toHaveLength(3);
    expect(container.querySelector("[data-guides]")).toBeNull();
  });

  it("while a draft is edited the guides and ruler show faint at rest, and at full strength while dragging", () => {
    sized();
    const builder = builderWith();
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} editing />);
    const guides = () => container.querySelector<HTMLElement>("[data-guides]");
    expect(guides()).not.toBeNull();
    expect(guides()?.style.backgroundImage).toContain("--color-line-subtle");
    expect(guides()).toHaveTextContent("0");
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(guides()?.style.backgroundImage).not.toContain("--color-line-subtle");
    expect(guides()?.style.backgroundImage).toContain("--color-line");
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    // Back to faint, not gone.
    expect(guides()?.style.backgroundImage).toContain("--color-line-subtle");
  });

  it("a grid nobody can move (the read-only published view, a past version) draws no guides; one with a builder that can move does, draft or not", () => {
    const grid = (props: Partial<React.ComponentProps<typeof PlanogramGrid>>) =>
      render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} {...props} />).container;
    expect(grid({}).querySelector("[data-guides]")).toBeNull();
    expect(grid({ builder: builderWith({ canMove: false }) }).querySelector("[data-guides]")).toBeNull();
    expect(grid({ builder: builderWith() }).querySelector("[data-guides]")).not.toBeNull();
  });

  it("draws each table of a set as its own labelled block", () => {
    const { container } = render(<PlanogramGrid layout={setBlocks([face("u", null, 3), face("f", "front", 2)])} items={[pant]} label="Set" onSelect={vi.fn()} />);
    expect(container.querySelector('[data-block="u"]')).toHaveTextContent("Upper");
    expect(container.querySelector('[data-block="f"]')).toHaveTextContent("Front table");
  });

  it("a tap on empty space deselects", () => {
    const builder = builderWith();
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const block = container.querySelector('[data-block="u"]');
    if (!block) throw new Error("no block");
    fireEvent.click(block);
    expect(builder.onEmpty).toHaveBeenCalled();
  });

  it("drags the selected tile in half-foot steps, shows guides meanwhile, and commits where it lands", () => {
    sized();
    const builder = builderWith();
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(container.querySelector("[data-guides]")).not.toBeNull();
    expect(container.querySelector("[data-drop-ghost]")).not.toBeNull();
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(builder.onCommit).toHaveBeenCalledWith(pant, expect.objectContaining({ ...fieldsOf(pant), col: 3 }), "Moved", expect.any(Function));
    // Back to the faint guides a movable grid always shows.
    expect(container.querySelector<HTMLElement>("[data-guides]")?.style.backgroundImage).toContain("--color-line-subtle");
  });

  it("an invalid drop says why and commits nothing", () => {
    sized();
    const builder = builderWith({ check: () => "Blocked by Tee" });
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(tile).toHaveAttribute("data-invalid");
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(builder.onRefused).toHaveBeenCalledWith("Blocked by Tee");
    expect(builder.onCommit).not.toHaveBeenCalled();
  });

  it("a press that barely moves is a tap, not a drag", () => {
    sized();
    const builder = builderWith();
    const onSelect = vi.fn();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={onSelect} builder={builder} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 2, clientY: 1 });
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 2, clientY: 1 });
    fireEvent.click(tile);
    expect(builder.onCommit).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("resizes from the right handle", () => {
    sized();
    const builder = builderWith();
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const handle = container.querySelector('[data-handle="right"]');
    if (!handle) throw new Error("no handle");
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 40, clientY: 0 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 40, clientY: 0 });
    expect(builder.onCommit).toHaveBeenCalledWith(pant, expect.objectContaining({ colSpan: 6 }), "Resized", expect.any(Function));
  });

  it("a touch on the moving tile never reaches the face swipe; elsewhere it still does (Review Focus 1)", () => {
    const onSwipe = vi.fn();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} onSwipe={onSwipe} builder={builderWith()} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.touchStart(tile, { touches: [{ clientX: 200, clientY: 5 }] });
    fireEvent.touchEnd(tile, { touches: [], changedTouches: [{ clientX: 60, clientY: 5 }] });
    expect(onSwipe).not.toHaveBeenCalled();
    const surface = screen.getByRole("region", { name: "T: 1 product" }).firstElementChild!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 5 }] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [{ clientX: 60, clientY: 5 }] });
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("only the moving tile takes the pointer from the browser (touch-action: none)", () => {
    const other = { ...pant, id: "p2", productId: "tee", productName: "Tee", col: 6 };
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, other]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builderWith()} />);
    const moving = screen.getByRole("button", { name: /High-Rise Pant/ });
    expect(moving).toHaveAttribute("data-lifted");
    expect(moving).toHaveClass("data-lifted:touch-none");
    expect(screen.getByRole("button", { name: /^Tee/ })).not.toHaveAttribute("data-lifted");
  });
});
