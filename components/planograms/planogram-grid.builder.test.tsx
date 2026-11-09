import { act, fireEvent, render, screen } from "@testing-library/react";
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
  canMove: true, check: () => null, onCommit: vi.fn(() => Promise.resolve()), onRefused: vi.fn(), onKey: vi.fn(), onEmpty: vi.fn(), onDragging: vi.fn(), ...over,
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
    expect(container.querySelector("[data-guides]")).toBeNull();
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

  it("arrow keys on the selected tile go to the builder, and Escape deselects", () => {
    const builder = builderWith();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.keyDown(tile, { key: "ArrowRight", shiftKey: true });
    expect(builder.onKey).toHaveBeenCalledWith(pant, "ArrowRight", true);
    fireEvent.keyDown(tile, { key: "Escape" });
    expect(builder.onEmpty).toHaveBeenCalled();
  });

  it("an arrow press is drawn where it lands while it saves, so the next press starts from there (DECISIONS 11-09)", () => {
    const onKey = vi.fn((item: GridItem) => ({ fields: { ...item, col: item.col + 1 }, verb: "Moved" as const }));
    const onCommit = vi.fn(() => new Promise<unknown>(() => {}));
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builderWith({ onKey, onCommit })} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /High-Rise Pant/ }), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("button", { name: /High-Rise Pant/ }), { key: "ArrowRight" });
    expect(onKey).toHaveBeenLastCalledWith(expect.objectContaining({ col: pant.col + 1 }), "ArrowRight", false);
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ col: pant.col + 1 }), expect.objectContaining({ col: pant.col + 2 }), "Moved", expect.any(Function));
  });

  it("a handle on the drawing space's edge turns inward, and still resizes that edge", () => {
    sized();
    const last = { ...pant, id: "p2", productId: "tee", productName: "Tee", col: 8 };
    const builder = builderWith();
    const { container, rerender } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, last]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const handle = (edge: string) => container.querySelector<HTMLElement>(`[data-handle="${edge}"]`)!;
    // First column: the left handle starts at the edge and reaches right, over the tile.
    expect(handle("left")).toHaveAttribute("data-inward");
    expect(handle("left").style.transform).toBe("translate(0, -50%)");
    expect(handle("top")).toHaveAttribute("data-inward");
    expect(handle("right")).not.toHaveAttribute("data-inward");
    fireEvent.pointerDown(handle("left"), { pointerId: 3, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle("left"), { pointerId: 3, clientX: 40, clientY: 0 });
    fireEvent.pointerUp(handle("left"), { pointerId: 3, clientX: 40, clientY: 0 });
    expect(builder.onCommit).toHaveBeenCalledWith(pant, expect.objectContaining({ col: 2, colSpan: 2 }), "Resized", expect.any(Function));
    // Last column: the right handle ends at the edge and reaches left.
    rerender(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, last]} label="T" selectedId="p2" onSelect={vi.fn()} builder={builder} />);
    expect(handle("right")).toHaveAttribute("data-inward");
    expect(handle("right").style.transform).toBe("translate(-100%, -50%)");
    expect(handle("left")).not.toHaveAttribute("data-inward");
    fireEvent.pointerDown(handle("right"), { pointerId: 4, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle("right"), { pointerId: 4, clientX: -40, clientY: 0 });
    fireEvent.pointerUp(handle("right"), { pointerId: 4, clientX: -40, clientY: 0 });
    expect(builder.onCommit).toHaveBeenLastCalledWith(last, expect.objectContaining({ col: 8, colSpan: 2 }), "Resized", expect.any(Function));
  });

  it("a swipe from an unselected tile still changes face; a mouse press on the moving tile doesn't (Review Focus 1)", () => {
    const onSwipe = vi.fn();
    const other = { ...pant, id: "p2", productId: "tee", productName: "Tee", col: 6 };
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, other]} label="T" selectedId="p1" onSelect={vi.fn()} onSwipe={onSwipe} builder={builderWith()} />);
    const tee = screen.getByRole("button", { name: /^Tee/ });
    fireEvent.touchStart(tee, { touches: [{ clientX: 200, clientY: 5 }] });
    fireEvent.touchEnd(tee, { touches: [], changedTouches: [{ clientX: 60, clientY: 5 }] });
    expect(onSwipe).toHaveBeenCalledTimes(1);
    const moving = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(moving, { pointerId: 5, pointerType: "mouse", button: 0, clientX: 200, clientY: 5 });
    fireEvent.pointerUp(moving, { pointerId: 5, pointerType: "mouse", clientX: 60, clientY: 5 });
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("a keyboard press after a handle drag still selects", () => {
    sized();
    const onSelect = vi.fn();
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={onSelect} builder={builderWith()} />);
    const handle = container.querySelector('[data-handle="right"]')!;
    fireEvent.pointerDown(handle, { pointerId: 6, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 6, clientX: 40, clientY: 0 });
    fireEvent.pointerUp(handle, { pointerId: 6, clientX: 40, clientY: 0 });
    // Enter on a button clicks it with detail 0.
    fireEvent.click(screen.getByRole("button", { name: /High-Rise Pant/ }), { detail: 0 });
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("a valid drop stays where it landed while its save is out; a refused save snaps it back", async () => {
    sized();
    let settle: (value: unknown) => void = () => {};
    const builder = builderWith({ onCommit: vi.fn(() => new Promise((resolve) => (settle = resolve))) });
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    const home = tile.style.left;
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(tile.style.left).toBe("calc(calc(var(--cell) * 3) + 1px)");
    expect(tile).toHaveAttribute("data-lifted");
    await act(async () => settle({ ok: false, message: "Changed on another device" }));
    expect(tile.style.left).toBe(home);
  });

  it("a second finger on the moving tile doesn't take over the drag", () => {
    sized();
    const builder = builderWith();
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId="p1" onSelect={vi.fn()} builder={builder} />);
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(tile, { pointerId: 2, button: 0, clientX: 100, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 61, clientY: 0 });
    expect(builder.onCommit).toHaveBeenCalledWith(pant, expect.objectContaining({ col: 3 }), "Moved", expect.any(Function));
  });

  it("a press that ends after its tile was deselected doesn't block the next drag", () => {
    sized();
    const builder = builderWith();
    const grid = (selectedId: string | null) => <PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" selectedId={selectedId} onSelect={vi.fn()} builder={builder} />;
    const { rerender } = render(grid("p1"));
    const tile = screen.getByRole("button", { name: /High-Rise Pant/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    rerender(grid(null));
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 0, clientY: 0 });
    rerender(grid("p1"));
    fireEvent.pointerDown(tile, { pointerId: 2, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile, { pointerId: 2, clientX: 61, clientY: 0 });
    fireEvent.pointerUp(tile, { pointerId: 2, clientX: 61, clientY: 0 });
    expect(builder.onCommit).toHaveBeenCalledWith(pant, expect.objectContaining({ col: 3 }), "Moved", expect.any(Function));
  });
});
