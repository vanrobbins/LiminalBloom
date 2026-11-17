// The tapped cell at the screen level (0.7.0.5 task 7 review): the drawing space moved off the page's origin (the
// grid scrolled), a turned block, and a set's several faces. Twenty pixels to a unit, two units to a row.

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { GridLayout } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import { PlanogramGrid, type GridBuilder } from "./planogram-grid";

const face = (faceId: string, setSide: PlanogramFace["setSide"], columns: number, rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "T", fixtureType: "table", side: "top", setSide, label: faceId, columns, rows,
});
const builder = (): GridBuilder => ({
  canMove: true, check: () => null, onCommit: vi.fn(() => Promise.resolve()), onRefused: vi.fn(), onKey: vi.fn(), onReorder: vi.fn(), onEmpty: vi.fn(), onDragging: vi.fn(), onAdd: vi.fn(),
});
/** The space's rect: `left` and `top` are where its origin sits on screen, `w` and `h` its size in units. */
const spaceAt = (left: number, top: number, w: number, h: number) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: left, y: top, left, top, right: left + w * 20, bottom: top + h * 20, width: w * 20, height: h * 20, toJSON: () => ({}) } as DOMRect);
function tapOn(faceId: string, x: number, y: number) {
  const el = document.querySelector<HTMLElement>(`[data-block="${faceId}"]`)!;
  fireEvent.pointerDown(el, { pointerType: "mouse", button: 0, clientX: x, clientY: y });
  fireEvent.pointerUp(el, { pointerType: "mouse", clientX: x, clientY: y });
  fireEvent.click(el, { clientX: x, clientY: y });
}
const show = (layout: GridLayout, b: GridBuilder) => render(<PlanogramGrid layout={layout} items={[]} label="T" onSelect={vi.fn()} builder={b} />);
const faces = [face("u", null, 12, 3), face("f", "front", 12, 2), face("l", "left", 6, 2)];

describe("the tapped cell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is read from where the drawing space sits on screen, not from the page's corner", () => {
    spaceAt(-40, 10, 12, 6);
    const b = builder();
    show(singleBlock(face("u", null, 12, 3)), b);
    tapOn("u", 130, 50);
    // (130 + 40) / 20 = unit 8.5; (50 - 10) / 20 = unit 2, which is row 1.
    expect(b.onAdd).toHaveBeenCalledWith({ faceId: "u", col: 8, row: 1 });
  });

  it("names the turned block's own column and row", () => {
    spaceAt(0, 0, 17, 11);
    const b = builder();
    show(setBlocks(faces), b);
    // The left lower is 4 units wide and 6 tall at the origin: unit (1, 3.5) is its column 3 on its outer row 1.
    tapOn("l", 20, 70);
    expect(b.onAdd).toHaveBeenCalledWith({ faceId: "l", col: 3, row: 1 });
    // Unit (3, 0.5): its column 0, the row against the upper.
    tapOn("l", 60, 10);
    expect(b.onAdd).toHaveBeenLastCalledWith({ faceId: "l", col: 0, row: 0 });
  });

  it("names the face tapped in a set, with the space scrolled", () => {
    spaceAt(-40, 10, 17, 11);
    const b = builder();
    show(setBlocks(faces), b);
    // The front lower starts at unit (5, 7): (110 + 40) / 20 = 7.5 and (180 - 10) / 20 = 8.5.
    tapOn("f", 110, 180);
    expect(b.onAdd).toHaveBeenCalledWith({ faceId: "f", col: 2, row: 0 });
    // The upper starts at unit (5, 0): unit (6.5, 4.5) is its column 1, row 2.
    tapOn("u", 90, 100);
    expect(b.onAdd).toHaveBeenLastCalledWith({ faceId: "u", col: 1, row: 2 });
  });
});
