import { describe, expect, it } from "vitest";

import { setBlocks, singleBlock, spanRect, type Block } from "../set-grid";
import type { PlacementFields, PlanogramFace } from "../types";

import { resizeEdges, resizeTarget, type Edge } from "./resize";

const wall: PlanogramFace = { faceId: "w", fixtureId: "w", fixtureName: "Wall bay 3", fixtureType: "wall_bay", side: "front", setSide: null, label: "Front", columns: 16, rows: 4 };
const block = singleBlock(wall).blocks[0];
const rail: PlacementFields = { faceId: "w", presentation: "hung", col: 4, row: 1, colSpan: 4, rowSpan: 2, pieceCount: 1 };

const top = (faceId: string, setSide: PlanogramFace["setSide"], columns: number, rows: number): PlanogramFace => ({ ...wall, faceId, fixtureType: "table", side: "top", setSide, columns, rows });
const turnedOf = (setSide: "left" | "right"): Block => {
  const b = setBlocks([top("u", null, 12, 3), top("t", setSide, 6, 4)]).blocks.find((x) => x.faceId === "t");
  if (!b) throw new Error("no turned block");
  return b;
};

describe("resizeTarget", () => {
  it("moves the right or bottom edge in half feet and levels", () => {
    expect(resizeTarget(block, rail, "right", 2.6, 0)).toEqual({ ...rail, colSpan: 7 });
    expect(resizeTarget(block, rail, "bottom", 0, 2.2)).toEqual({ ...rail, rowSpan: 3 });
  });

  it("moves the left or top edge and keeps the other edge where it was", () => {
    expect(resizeTarget(block, rail, "left", -1.2, 0)).toEqual({ ...rail, col: 3, colSpan: 5 });
    expect(resizeTarget(block, rail, "top", 0, -2)).toEqual({ ...rail, row: 0, rowSpan: 3 });
  });

  it("never goes below half a foot by one level", () => {
    expect(resizeTarget(block, rail, "left", 10, 0)).toEqual({ ...rail, col: 7, colSpan: 1 });
    expect(resizeTarget(block, rail, "right", -10, 0)).toEqual({ ...rail, colSpan: 1 });
    expect(resizeTarget(block, rail, "top", 0, 10)).toEqual({ ...rail, row: 2, rowSpan: 1 });
  });

  // The edge the user drags moves by the (snapped) drag in screen space; the opposite edge stays.
  const screenEdges = (b: Block, c: PlacementFields) => {
    const r = spanRect(b, c);
    return { left: r.x, right: r.x + r.width, top: r.y, bottom: r.y + r.height };
  };
  const OPPOSITE: Record<Edge, Edge> = { left: "right", right: "left", top: "bottom", bottom: "top" };
  const cases: [string, "wall" | "left" | "right", Edge, number, number][] = [
    ["plain, right edge out", "wall", "right", 2, 0],
    ["plain, left edge out", "wall", "left", -1, 0],
    ["plain, bottom edge out", "wall", "bottom", 0, 4],
    ["left lower, right edge out", "left", "right", 4, 0],
    ["left lower, left edge out", "left", "left", -4, 0],
    ["left lower, right edge in", "left", "right", -2, 0],
    ["right lower, right edge out", "right", "right", 2, 0],
    ["right lower, left edge out", "right", "left", -4, 0],
    ["right lower, left edge in", "right", "left", 2, 0],
    ["turned, bottom edge out", "left", "bottom", 0, 3],
    ["turned, top edge out", "right", "top", 0, -2],
  ];
  it.each(cases)("%s: dragged edge follows, opposite edge stays", (_name, where, edge, dx, dy) => {
    const b = where === "wall" ? block : turnedOf(where);
    const fold: PlacementFields = { ...rail, faceId: b.faceId, col: 4, row: 1, colSpan: 3, rowSpan: 2 };
    const before = screenEdges(b, fold);
    const after = screenEdges(b, resizeTarget(b, fold, edge, dx, dy));
    const horizontal = edge === "left" || edge === "right";
    expect(after[edge]).toBe(before[edge] + (horizontal ? dx : dy));
    expect(after[OPPOSITE[edge]]).toBe(before[OPPOSITE[edge]]);
  });

  it("on a turned table, the left edge is the row end and the right edge the row start", () => {
    const turned = turnedOf("left");
    const fold = { ...rail, faceId: "t", col: 0, row: 1, colSpan: 4, rowSpan: 1 };
    expect(resizeTarget(turned, fold, "right", 2, 0)).toEqual({ ...fold, row: 0, rowSpan: 2 });
    expect(resizeTarget(turned, fold, "left", -2, 0)).toEqual({ ...fold, rowSpan: 2 });
    expect(resizeTarget(turned, fold, "bottom", 0, 1)).toEqual({ ...fold, colSpan: 5 });
  });
});

describe("resizeEdges", () => {
  it("offers level handles only when the face has more than one level", () => {
    expect(resizeEdges(block)).toEqual(["left", "right", "top", "bottom"]);
    expect(resizeEdges(singleBlock({ ...wall, rows: 1 }).blocks[0])).toEqual(["left", "right"]);
  });
});
