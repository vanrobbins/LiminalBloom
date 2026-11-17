// Tap empty space to add (0.7.0.5 task 7, spec §2.2): a still tap on empty grid space with nothing selected asks
// the builder to add at that cell; with a tile selected it only deselects; a pan, a scroll or a read-only grid
// does nothing; Enter on the focused grid asks for the first open spot (no cell).

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { PlanogramGrid, type GridBuilder } from "./planogram-grid";

const face: PlanogramFace = { faceId: "u", fixtureId: "u", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 3 };
const pant: GridItem = { faceId: "u", presentation: "folded", pieceCount: 6, imageKey: null, categoryName: "Denim", id: "p1", productId: "pant", productName: "Pant", styleNumber: "P-1", col: 0, row: 0, colSpan: 4, rowSpan: 2 };

const builderWith = (over: Partial<GridBuilder> = {}): GridBuilder => ({
  canMove: true, check: () => null, onCommit: vi.fn(() => Promise.resolve()), onRefused: vi.fn(), onKey: vi.fn(), onReorder: vi.fn(), onEmpty: vi.fn(), onDragging: vi.fn(), onAdd: vi.fn(), ...over,
});
const grid = (selectedId: string | null, builder: GridBuilder | undefined) => (
  <PlanogramGrid layout={singleBlock(face)} items={[pant]} label="T" selectedId={selectedId} onSelect={vi.fn()} builder={builder} />
);
const block = () => document.querySelector<HTMLElement>("[data-block]")!;
// 12 units across, drawn 240 px wide: 20 px a unit, and 40 px a row (a row is two units).
const sized = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, toJSON: () => ({}) } as DOMRect);
/** A press and release at one place, then the click the browser sends. */
function tap(at: { x: number; y: number }, to = at) {
  fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: at.x, clientY: at.y });
  fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: to.x, clientY: to.y });
  fireEvent.click(block(), { clientX: to.x, clientY: to.y });
}

describe("tap empty space to add", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("a still tap with nothing selected asks to add at the tapped face, column and row", () => {
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    tap({ x: 130, y: 50 });
    expect(builder.onAdd).toHaveBeenCalledWith({ faceId: "u", col: 6, row: 1 });
    expect(builder.onEmpty).not.toHaveBeenCalled();
  });

  it("a tap that wobbles under the threshold still counts", () => {
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    tap({ x: 130, y: 50 }, { x: 132, y: 51 });
    expect(builder.onAdd).toHaveBeenCalledWith({ faceId: "u", col: 6, row: 1 });
  });

  it("the end of a pan does not add", () => {
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    tap({ x: 130, y: 50 }, { x: 190, y: 50 });
    expect(builder.onAdd).not.toHaveBeenCalled();
  });

  it("a press that scrolled the grid does not add, though the finger came back to where it began", () => {
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    const scroller = block().closest<HTMLElement>(".overflow-x-auto")!;
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 130, clientY: 50 });
    scroller.scrollLeft = 40;
    fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: 130, clientY: 50 });
    fireEvent.click(block(), { clientX: 130, clientY: 50 });
    expect(builder.onAdd).not.toHaveBeenCalled();
  });

  it("a press the browser took for a scroll (pointercancel) is forgotten, so a later click with no press of its own (assistive tech) is judged alone", () => {
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    fireEvent.pointerDown(block(), { pointerType: "touch", button: 0, clientX: 130, clientY: 50 });
    fireEvent.pointerCancel(block(), { pointerType: "touch" });
    fireEvent.click(block(), { clientX: 190, clientY: 50 });
    expect(builder.onAdd).toHaveBeenCalledWith({ faceId: "u", col: 9, row: 1 });
  });

  it("an old press's timer can't wipe a newer press held past it: its moved release on the grid does not add", () => {
    vi.useFakeTimers();
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    // Press A is released with no click; press B starts inside the 300 ms and is held past it.
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 130, clientY: 50 });
    fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: 130, clientY: 50 });
    vi.advanceTimersByTime(100);
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 130, clientY: 50 });
    vi.advanceTimersByTime(350);
    fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: 190, clientY: 50 });
    fireEvent.click(block(), { clientX: 190, clientY: 50 });
    expect(builder.onAdd).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("leaving removes the pointerup listener and the pending timer", () => {
    vi.useFakeTimers();
    sized();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(grid(null, builderWith()));
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 130, clientY: 50 });
    unmount();
    expect(remove).toHaveBeenCalledWith("pointerup", expect.any(Function));
    // A release before leaving leaves a timer; leaving clears that too.
    const second = render(grid(null, builderWith()));
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 130, clientY: 50 });
    fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: 130, clientY: 50 });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("a click with no press before it (assistive tech) is a tap", () => {
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    fireEvent.click(block(), { clientX: 130, clientY: 50 });
    expect(builder.onAdd).toHaveBeenCalledWith({ faceId: "u", col: 6, row: 1 });
  });

  it("with a tile selected a tap only deselects", () => {
    sized();
    const builder = builderWith();
    render(grid("p1", builder));
    tap({ x: 130, y: 50 });
    expect(builder.onEmpty).toHaveBeenCalledTimes(1);
    expect(builder.onAdd).not.toHaveBeenCalled();
  });

  it("a grid that can't change anything (no builder) has nothing to call", () => {
    sized();
    render(grid(null, undefined));
    expect(() => tap({ x: 130, y: 50 })).not.toThrow();
  });

  it("a builder that can't add (no onAdd) just deselects as before", () => {
    sized();
    const builder = builderWith({ onAdd: undefined });
    render(grid(null, builder));
    tap({ x: 130, y: 50 });
    expect(builder.onEmpty).toHaveBeenCalledTimes(1);
  });

  it("Enter on the focused grid asks to add at the first open spot, with no cell", () => {
    const builder = builderWith();
    render(grid(null, builder));
    const section = document.querySelector<HTMLElement>("[data-planogram-grid]")!;
    section.focus();
    fireEvent.keyDown(section, { key: "Enter" });
    expect(builder.onAdd).toHaveBeenCalledWith();
  });

  it("Enter does nothing with a tile selected, from a tile, or without onAdd", () => {
    const builder = builderWith();
    const { rerender } = render(grid("p1", builder));
    const section = document.querySelector<HTMLElement>("[data-planogram-grid]")!;
    fireEvent.keyDown(section, { key: "Enter" });
    rerender(grid(null, builder));
    fireEvent.keyDown(screen.getByRole("button", { name: /^Pant, / }), { key: "Enter" });
    rerender(grid(null, builderWith({ onAdd: undefined })));
    fireEvent.keyDown(section, { key: "Enter" });
    expect(builder.onAdd).not.toHaveBeenCalled();
  });
});
