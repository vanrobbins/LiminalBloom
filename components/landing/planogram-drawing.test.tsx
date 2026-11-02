import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanogramDrawing, TILES, pieceCount } from "./planogram-drawing";

describe("PlanogramDrawing", () => {
  it("is hidden from assistive tech, since its caption says it in words", () => {
    const { container } = render(<PlanogramDrawing />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws gold on the selected tile only (§5.5)", () => {
    const { container } = render(<PlanogramDrawing />);
    const gold = [...container.querySelectorAll("[class]")].filter((el) => /\b(fill|stroke)-brand\b/.test(el.getAttribute("class") ?? ""));
    expect(gold).toHaveLength(1);
    expect(gold[0].closest("[data-selected]")).not.toBeNull();
    expect(container.querySelectorAll("[data-selected]")).toHaveLength(1);
  });

  it("keeps every tile on the 12-column, 3-level rack without overlaps", () => {
    const taken = new Set<string>();
    for (const tile of TILES) {
      expect(tile.x + tile.w).toBeLessThanOrEqual(12);
      expect(tile.y).toBeLessThan(3);
      for (let c = tile.x; c < tile.x + tile.w; c++) {
        const cell = `${c},${tile.y}`;
        expect(taken.has(cell)).toBe(false);
        taken.add(cell);
      }
    }
  });

  it("fits one to three pieces in a tile, by its width", () => {
    expect(pieceCount(2)).toBe(1);
    expect(pieceCount(3)).toBe(2);
    expect(pieceCount(4)).toBe(2);
    expect(pieceCount(6)).toBe(3);
    expect(pieceCount(12)).toBe(3);
  });
});
