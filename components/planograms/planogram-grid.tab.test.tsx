// The grid as a tab stop and a press that was never completed (0.7.0.5 task 7 review): with an add available and
// nothing selected the grid is reached by Tab and says Enter adds; a press whose release lands elsewhere is
// forgotten, so a later click with no press of its own (keyboard, assistive tech) is judged alone.

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const grid = (selectedId: string | null, builder: GridBuilder | undefined, onSelect = vi.fn()) => (
  <PlanogramGrid layout={singleBlock(face)} items={[pant]} label="T" selectedId={selectedId} onSelect={onSelect} builder={builder} />
);
const section = () => document.querySelector<HTMLElement>("[data-planogram-grid]")!;
const block = () => document.querySelector<HTMLElement>("[data-block]")!;
const sized = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, toJSON: () => ({}) } as DOMRect);

describe("the grid as a tab stop", () => {
  it("is the first stop, ahead of its tiles, and Enter there adds at the first open spot", async () => {
    const builder = builderWith();
    render(grid(null, builder));
    const user = userEvent.setup();
    await user.tab();
    expect(section()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(builder.onAdd).toHaveBeenCalledWith();
    await user.tab();
    expect(screen.getByRole("button", { name: /^Pant, / })).toHaveFocus();
  });

  it("says that Enter adds a product", () => {
    render(grid(null, builderWith()));
    expect(section()).toHaveAttribute("aria-description", expect.stringMatching(/Enter.*add a product/i));
  });

  it("is not a stop with a tile selected (Enter would do nothing), without onAdd, or read-only, but still takes focus from code", () => {
    const { rerender } = render(grid("p1", builderWith()));
    expect(section()).toHaveAttribute("tabindex", "-1");
    rerender(grid(null, builderWith({ onAdd: undefined })));
    expect(section()).toHaveAttribute("tabindex", "-1");
    rerender(grid(null, undefined));
    expect(section()).toHaveAttribute("tabindex", "-1");
    expect(section()).not.toHaveAttribute("aria-description");
  });

  it("Enter on a focused tile still selects it and never adds", async () => {
    const onSelect = vi.fn();
    const builder = builderWith();
    render(grid(null, builder, onSelect));
    screen.getByRole("button", { name: /^Pant, / }).focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalled();
    expect(builder.onAdd).not.toHaveBeenCalled();
  });
});

describe("a press that never completes a click", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is forgotten once its release has come and gone, so a later click with no press of its own is a tap", () => {
    vi.useFakeTimers();
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 10, clientY: 10 });
    // Released over something else: no click follows.
    fireEvent.pointerUp(document.body, { pointerType: "mouse", clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(1000);
    // A keyboard or assistive-tech click carries other coordinates.
    fireEvent.click(block(), { clientX: 130, clientY: 50 });
    expect(builder.onAdd).toHaveBeenCalledWith({ faceId: "u", col: 6, row: 1 });
  });

  it("still counts for the click that follows its own release", () => {
    vi.useFakeTimers();
    sized();
    const builder = builderWith();
    render(grid(null, builder));
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 130, clientY: 50 });
    fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: 190, clientY: 50 });
    fireEvent.click(block(), { clientX: 190, clientY: 50 });
    expect(builder.onAdd).not.toHaveBeenCalled();
  });
});
