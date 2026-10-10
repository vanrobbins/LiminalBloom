import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramFace } from "@/lib/planograms/types";

import { PlanogramGrid } from "./planogram-grid";

const face = (faceId: string, setSide: PlanogramFace["setSide"], rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "Front Table set", side: "top", setSide, label: faceId === "u" ? "Upper" : "Front table", columns: 6, rows,
});
const pant = { id: "p1", faceId: "u", productId: "pant", productName: "High-Rise Pant", presentation: "folded" as const, pieceCount: 6, col: 0, row: 0, colSpan: 2, rowSpan: 2 };

describe("PlanogramGrid", () => {
  it("names itself and draws each placement", () => {
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="Front Table set, Top" />);
    expect(screen.getByRole("img", { name: "Front Table set, Top: 1 product" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-placement]")).toHaveLength(1);
  });

  it("a tap on a lower table's open cell picks that table's face", () => {
    const onEmptyCell = vi.fn();
    const { container } = render(
      <PlanogramGrid layout={setBlocks([face("u", null, 3), face("f", "front", 2)])} items={[pant]} label="Set" onEmptyCell={onEmptyCell} />,
    );
    const cell = container.querySelector('[data-cell="f:1:0"]');
    expect(cell).not.toBeNull();
    if (cell) fireEvent.click(cell);
    expect(onEmptyCell).toHaveBeenCalledWith({ faceId: "f", col: 1, row: 0 });
  });

  it("marks the highlighted product and the selection", () => {
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant]} label="T" highlightProductId="pant" />);
    expect(container.querySelector("[data-placement]")).toHaveAttribute("data-marked");
  });

  it("marks the selection with a heavier outline, not colour alone", () => {
    const other = { ...pant, id: "p2", productId: "other", col: 3 };
    const { container } = render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, other]} label="T" selectedId="p1" />);
    const stroke = (id: string) => Number(container.querySelector(`[data-placement="${id}"] rect`)?.getAttribute("stroke-width"));
    expect(stroke("p1")).toBeGreaterThan(stroke("p2"));
  });

  it("counts only the products on faces it draws", () => {
    const onOther = { ...pant, id: "p3", faceId: "elsewhere" };
    render(<PlanogramGrid layout={singleBlock(face("u", null, 3))} items={[pant, onOther]} label="T" />);
    expect(screen.getByRole("img", { name: "T: 1 product" })).toBeInTheDocument();
  });
});
