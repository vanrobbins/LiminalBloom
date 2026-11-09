import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { LayerList } from "./layer-list";
import { PlanogramGrid } from "./planogram-grid";

const rack: PlanogramFace = { faceId: "f", fixtureId: "r", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 4 };
const tee = (id: string, name: string, col: number, depth: number): GridItem => ({
  id, faceId: "f", productId: id, productName: name, styleNumber: id, presentation: "hung", pieceCount: 2, col, row: 0, colSpan: 4, rowSpan: 2, depth, imageKey: null, categoryName: "Tops",
});
const navy = tee("navy", "Navy Tee", 0, 0);
const sand = tee("sand", "Sand Tee", 1, 1);
const pant = tee("pant", "Wide Pant", 2, 2);
const apart = tee("apart", "Cap", 8, 0);

describe("layered tiles on the grid", () => {
  const tile = (id: string, container: HTMLElement) => container.querySelector<HTMLElement>(`[data-placement="${id}"]`)!;

  it("draws the front one on top, each one behind offset up and right, with no card, and Tab meets the front first", () => {
    const { container } = render(<PlanogramGrid layout={singleBlock(rack)} items={[pant, apart, sand, navy]} label="T" onSelect={vi.fn()} />);
    expect(Number(tile("navy", container).style.zIndex)).toBeGreaterThan(Number(tile("sand", container).style.zIndex));
    expect(Number(tile("sand", container).style.zIndex)).toBeGreaterThan(Number(tile("pant", container).style.zIndex));
    expect(tile("navy", container).style.transform).toBe("");
    expect(tile("sand", container).style.transform).toContain("+ 6px");
    expect(tile("pant", container).style.transform).toContain("+ 12px");
    expect(tile("sand", container)).toHaveAttribute("data-layered");
    expect(tile("apart", container)).not.toHaveAttribute("data-layered");
    // Clicks land on the painted garment, not the empty box.
    expect(tile("sand", container).style.pointerEvents).toBe("none");
    const order = [...container.querySelectorAll("[data-placement]")].map((e) => e.getAttribute("data-placement"));
    expect(order.indexOf("navy")).toBeLessThan(order.indexOf("sand"));
    expect(order.indexOf("sand")).toBeLessThan(order.indexOf("pant"));
  });

  it("the selected one rises to the top and takes its whole box", () => {
    const { container } = render(<PlanogramGrid layout={singleBlock(rack)} items={[navy, sand, pant]} label="T" selectedId="pant" onSelect={vi.fn()} />);
    expect(Number(tile("pant", container).style.zIndex)).toBeGreaterThan(Number(tile("navy", container).style.zIndex));
    expect(tile("pant", container).style.pointerEvents).toBe("");
  });
});

describe("LayerList", () => {
  it("lists the group front to back and picks a row's product", () => {
    const onPick = vi.fn();
    render(<LayerList item={sand} items={[pant, apart, sand, navy]} onPick={onPick} />);
    const rows = within(screen.getByRole("list")).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual(["Navy Tee2 pieces", "Sand Tee2 pieces", "Wide Pant2 pieces"]);
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    fireEvent.click(rows[2]);
    expect(onPick).toHaveBeenCalledWith("pant");
    expect(screen.queryByRole("button", { name: "Move forward" })).toBeNull();
  });

  it("shows nothing for a product that shares no space", () => {
    const { container } = render(<LayerList item={apart} items={[navy, apart]} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("moves the open one forward or back, disabled at each end", () => {
    const onReorder = vi.fn();
    const { rerender } = render(<LayerList item={sand} items={[navy, sand, pant]} onPick={vi.fn()} onReorder={onReorder} />);
    fireEvent.click(screen.getByRole("button", { name: "Move forward" }));
    expect(onReorder).toHaveBeenCalledWith(sand, "forward");
    fireEvent.click(screen.getByRole("button", { name: "Move back" }));
    expect(onReorder).toHaveBeenLastCalledWith(sand, "back");
    rerender(<LayerList item={navy} items={[navy, sand, pant]} onPick={vi.fn()} onReorder={onReorder} />);
    expect(screen.getByRole("button", { name: "Move forward" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move back" })).toBeEnabled();
  });
});
