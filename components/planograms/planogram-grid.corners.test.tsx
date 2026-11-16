// The selected tile's corner discs on the grid (0.7.0.5 task 5): where they sit in the tab order, which keys
// act on the tile, what trash does while the server answers, and that they turn inward at every edge of the
// drawing space. The discs' own geometry is tile-corners.test.tsx.

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { PlanogramGrid, type GridBuilder } from "./planogram-grid";

const face: PlanogramFace = { faceId: "u", fixtureId: "u", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 3 };
const base = { faceId: "u", presentation: "folded", pieceCount: 6, imageKey: null, categoryName: "Denim" } as const;
const pant: GridItem = { ...base, id: "p1", productId: "pant", productName: "Pant", styleNumber: "P-1", col: 0, row: 0, colSpan: 4, rowSpan: 2 };
const tee: GridItem = { ...base, id: "p2", productId: "tee", productName: "Tee", styleNumber: "T-1", col: 5, row: 0, colSpan: 4, rowSpan: 2 };

const builderWith = (over: Partial<GridBuilder> = {}): GridBuilder => ({
  canMove: true, check: () => null, onCommit: vi.fn(() => Promise.resolve()), onRefused: vi.fn(), onKey: vi.fn(), onReorder: vi.fn(), onEmpty: vi.fn(), onDragging: vi.fn(),
  onRemove: vi.fn(() => Promise.resolve(true)), onEdit: vi.fn(), ...over,
});
const grid = (items: GridItem[], selectedId: string | null, builder: GridBuilder | undefined) => (
  <PlanogramGrid layout={singleBlock(face)} items={items} label="T" selectedId={selectedId} onSelect={vi.fn()} builder={builder} />
);
const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}, `) });
const disc = (name: string) => screen.queryByRole("button", { name });
// 12 units across, drawn 240 px wide: 20 px a unit.
const sized = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, toJSON: () => ({}) } as DOMRect);

describe("the selected tile's corner discs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sit straight after the selected tile in the tab order: tile, trash, pencil, then the next tile", async () => {
    const user = userEvent.setup();
    render(grid([pant, tee], "p1", builderWith()));
    tile("Pant").focus();
    await user.tab();
    expect(disc("Remove Pant")).toHaveFocus();
    await user.tab();
    expect(disc("Edit Pant")).toHaveFocus();
    await user.tab();
    expect(tile("Tee")).toHaveFocus();
  });

  it("show on the selected tile only, and not at all for a grid that can't remove or edit", () => {
    const { rerender } = render(grid([pant, tee], "p1", builderWith()));
    expect(disc("Remove Pant")).not.toBeNull();
    expect(disc("Remove Tee")).toBeNull();
    expect(disc("Edit Tee")).toBeNull();
    rerender(grid([pant, tee], "p1", builderWith({ onRemove: undefined, onEdit: undefined })));
    expect(disc("Remove Pant")).toBeNull();
    rerender(grid([pant, tee], "p1", undefined));
    expect(disc("Edit Pant")).toBeNull();
    rerender(grid([pant, tee], null, builderWith()));
    expect(disc("Remove Pant")).toBeNull();
  });

  it("the pencil opens the panel for its tile", async () => {
    const builder = builderWith();
    render(grid([pant, tee], "p1", builder));
    await userEvent.click(disc("Edit Pant")!);
    expect(builder.onEdit).toHaveBeenCalledWith(pant);
  });

  it("Escape on a disc deselects and puts focus back on the tile", () => {
    const builder = builderWith();
    render(grid([pant, tee], "p1", builder));
    disc("Remove Pant")!.focus();
    fireEvent.keyDown(disc("Remove Pant")!, { key: "Escape" });
    expect(builder.onEmpty).toHaveBeenCalledTimes(1);
    expect(tile("Pant")).toHaveFocus();
  });

  it.each(["Delete", "Backspace"])("%s on the selected tile removes it with no dialog; the tile fades while the server answers", async (key) => {
    const builder = builderWith({ onRemove: vi.fn(() => new Promise<boolean>(() => {})) });
    render(grid([pant, tee], "p1", builder));
    fireEvent.keyDown(tile("Pant"), { key });
    expect(tile("Pant")).toHaveAttribute("data-leaving");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(builder.onRemove).toHaveBeenCalledWith(pant));
    expect(builder.onRemove).toHaveBeenCalledTimes(1);
    // Its discs go with it.
    expect(disc("Remove Pant")).toBeNull();
  });

  it("the trash disc removes the same way, once however often it's pressed", async () => {
    const builder = builderWith({ onRemove: vi.fn(() => new Promise<boolean>(() => {})) });
    render(grid([pant, tee], "p1", builder));
    await userEvent.click(disc("Remove Pant")!);
    expect(tile("Pant")).toHaveAttribute("data-leaving");
    await waitFor(() => expect(builder.onRemove).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(tile("Pant"), { key: "Delete" });
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 200))));
    expect(builder.onRemove).toHaveBeenCalledTimes(1);
  });

  it("Delete on a tile that isn't selected does nothing", () => {
    const builder = builderWith();
    render(grid([pant, tee], "p1", builder));
    fireEvent.keyDown(tile("Tee"), { key: "Delete" });
    expect(tile("Tee")).not.toHaveAttribute("data-leaving");
    expect(builder.onRemove).not.toHaveBeenCalled();
  });

  it("a removal the server refuses restores the tile and its discs", async () => {
    let refuse: (ok: boolean) => void = () => {};
    const builder = builderWith({ onRemove: vi.fn(() => new Promise<boolean>((resolve) => (refuse = resolve))) });
    render(grid([pant, tee], "p1", builder));
    fireEvent.keyDown(tile("Pant"), { key: "Delete" });
    await waitFor(() => expect(builder.onRemove).toHaveBeenCalled());
    expect(tile("Pant")).toHaveAttribute("data-leaving");
    await act(async () => refuse(false));
    expect(tile("Pant")).not.toHaveAttribute("data-leaving");
    await waitFor(() => expect(disc("Remove Pant")).not.toBeNull());
    expect(disc("Edit Pant")).not.toBeNull();
  });

  it("are hidden while the tile is dragged and come back on the drop", () => {
    sized();
    render(grid([pant, tee], "p1", builderWith()));
    expect(disc("Remove Pant")).not.toBeNull();
    fireEvent.pointerDown(tile("Pant"), { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(tile("Pant"), { pointerId: 1, clientX: 61, clientY: 0 });
    expect(disc("Remove Pant")).toBeNull();
    expect(disc("Edit Pant")).toBeNull();
    fireEvent.pointerUp(tile("Pant"), { pointerId: 1, clientX: 61, clientY: 0 });
    expect(disc("Remove Pant")).not.toBeNull();
  });

  it("are hidden while a handle resizes it", () => {
    sized();
    const { container } = render(grid([pant, tee], "p1", builderWith()));
    const handle = container.querySelector('[data-handle="right"]')!;
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 40, clientY: 0 });
    expect(disc("Remove Pant")).toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 40, clientY: 0 });
    expect(disc("Remove Pant")).not.toBeNull();
  });

  // The drawing space is 12 units wide and 6 tall; the scroller clips at all four sides.
  it.each([
    ["left", { col: 0, row: 1, colSpan: 4, rowSpan: 1 }, "Remove", "x"],
    ["top", { col: 4, row: 0, colSpan: 4, rowSpan: 1 }, "Remove", "y"],
    ["right", { col: 8, row: 1, colSpan: 4, rowSpan: 1 }, "Edit", "x"],
    ["bottom", { col: 4, row: 2, colSpan: 4, rowSpan: 1 }, "Edit", "y"],
  ] as const)("at the %s edge of the grid the %s disc's target turns inward", (_edge, cells, which, axis) => {
    render(grid([{ ...pant, ...cells }], "p1", builderWith()));
    expect(disc(`${which} Pant`)).toHaveAttribute(`data-${axis}`, "in");
  });

  it("a tile in the middle of the grid has neither disc turned inward", () => {
    render(grid([{ ...pant, col: 4, row: 1, colSpan: 4, rowSpan: 1 }], "p1", builderWith()));
    for (const name of ["Remove Pant", "Edit Pant"]) {
      expect(disc(name)).not.toHaveAttribute("data-x", "in");
      expect(disc(name)).not.toHaveAttribute("data-y", "in");
    }
  });

  it("a keyboard press that selects shows them without animation; a pointer tap animates them", () => {
    const { rerender } = render(grid([pant, tee], null, builderWith()));
    fireEvent.click(tile("Pant"), { detail: 0 });
    rerender(grid([pant, tee], "p1", builderWith()));
    expect(disc("Remove Pant")!.className).not.toContain("animate-disc");
    fireEvent.click(tile("Tee"), { detail: 1 });
    rerender(grid([pant, tee], "p2", builderWith()));
    expect(disc("Remove Tee")!.className).toContain("motion-safe:animate-disc-in");
  });
});
