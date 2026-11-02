import { describe, expect, it } from "vitest";

import { setBlocks, singleBlock, spanRect } from "../set-grid";
import type { PlacementFields, PlanogramFace } from "../types";

import { keyTarget } from "./keys";

const wall: PlanogramFace = { faceId: "w", fixtureId: "w", fixtureName: "Wall bay 3", fixtureType: "wall_bay", side: "front", setSide: null, label: "Front", columns: 16, rows: 4 };
const layout = singleBlock(wall);
const rail: PlacementFields = { faceId: "w", presentation: "hung", col: 4, row: 1, colSpan: 4, rowSpan: 2, pieceCount: 1 };

describe("keyTarget", () => {
  it("moves half a foot or one level per arrow", () => {
    expect(keyTarget(layout, rail, "ArrowRight", false)).toEqual({ ...rail, col: 5 });
    expect(keyTarget(layout, rail, "ArrowLeft", false)).toEqual({ ...rail, col: 3 });
    expect(keyTarget(layout, rail, "ArrowDown", false)).toEqual({ ...rail, row: 2 });
    expect(keyTarget(layout, rail, "ArrowUp", false)).toEqual({ ...rail, row: 0 });
  });

  it("resizes with Shift: right and down grow, left and up shrink", () => {
    expect(keyTarget(layout, rail, "ArrowRight", true)).toEqual({ ...rail, colSpan: 5 });
    expect(keyTarget(layout, rail, "ArrowLeft", true)).toEqual({ ...rail, colSpan: 3 });
    expect(keyTarget(layout, rail, "ArrowDown", true)).toEqual({ ...rail, rowSpan: 3 });
    expect(keyTarget(layout, rail, "ArrowUp", true)).toEqual({ ...rail, rowSpan: 1 });
  });

  it("ignores every other key", () => {
    expect(keyTarget(layout, rail, "Enter", false)).toBeNull();
  });

  describe("on a turned table, arrows act in screen space", () => {
    const table = (faceId: string, setSide: PlanogramFace["setSide"], columns: number, rows: number): PlanogramFace => ({ ...wall, faceId, fixtureType: "table", side: "top", setSide, columns, rows });
    const turnedLayout = setBlocks([table("u", null, 12, 3), table("t", "left", 8, 4)]);
    const turned = turnedLayout.blocks.find((b) => b.faceId === "t");
    if (!turned) throw new Error("no turned block");
    const fold: PlacementFields = { ...rail, faceId: "t", col: 2, row: 1, colSpan: 3, rowSpan: 2 };
    const screen = (key: string, shift: boolean) => {
      const next = keyTarget(turnedLayout, fold, key, shift);
      if (!next) throw new Error("no target");
      return spanRect(turned, next);
    };
    const at = spanRect(turned, fold);

    it("moves the tile one step in the arrow's direction", () => {
      expect(screen("ArrowRight", false)).toEqual({ ...at, x: at.x + 2 });
      expect(screen("ArrowLeft", false)).toEqual({ ...at, x: at.x - 2 });
      expect(screen("ArrowDown", false)).toEqual({ ...at, y: at.y + 1 });
      expect(screen("ArrowUp", false)).toEqual({ ...at, y: at.y - 1 });
    });

    it("Shift moves the screen-right and bottom edges while the left and top stay", () => {
      expect(screen("ArrowRight", true)).toEqual({ ...at, width: at.width + 2 });
      expect(screen("ArrowLeft", true)).toEqual({ ...at, width: at.width - 2 });
      expect(screen("ArrowDown", true)).toEqual({ ...at, height: at.height + 1 });
      expect(screen("ArrowUp", true)).toEqual({ ...at, height: at.height - 1 });
    });
  });
});
