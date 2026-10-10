import { describe, expect, it } from "vitest";

import { cellAt, SET_GAP, setBlocks, singleBlock, spanRect } from "./set-grid";
import type { PlanogramFace } from "./types";

const face = (faceId: string, setSide: PlanogramFace["setSide"], columns: number, rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "T", side: "top", setSide, label: faceId, columns, rows,
});

describe("setBlocks", () => {
  it("joins each lower top on its side of the upper", () => {
    const { blocks, width, height } = setBlocks([face("u", null, 6, 3), face("f", "front", 6, 2), face("l", "left", 3, 2)]);
    const by = (id: string) => blocks.find((b) => b.faceId === id);
    // Left is turned: 2 rows wide, 3 columns tall, beside the upper.
    expect(by("l")).toMatchObject({ x: 0, y: 0, width: 2, height: 3, turned: true });
    expect(by("u")).toMatchObject({ x: 2 + SET_GAP, y: 0, width: 6, height: 3, turned: false });
    expect(by("f")).toMatchObject({ x: 2 + SET_GAP, y: 3 + SET_GAP, width: 6, height: 2, turned: false });
    expect(width).toBe(2 + SET_GAP + 6);
    expect(height).toBe(3 + SET_GAP + 2);
  });

  it("puts a back table above and shifts everything so nothing is negative", () => {
    const { blocks } = setBlocks([face("u", null, 6, 3), face("b", "back", 4, 2)]);
    expect(blocks.find((b) => b.faceId === "b")).toMatchObject({ x: 1, y: 0 });
    expect(blocks.find((b) => b.faceId === "u")).toMatchObject({ x: 0, y: 2 + SET_GAP });
  });
});

describe("spanRect and cellAt", () => {
  const { blocks } = setBlocks([face("u", null, 6, 3), face("r", "right", 3, 2)]);
  const right = blocks.find((b) => b.faceId === "r");

  it("turns a right table's cells: columns run down, rows across", () => {
    expect(right).toBeDefined();
    if (!right) return;
    expect(spanRect(right, { col: 1, row: 0, colSpan: 2, rowSpan: 1 })).toEqual({ x: right.x, y: 1, width: 1, height: 2 });
  });

  it("finds the face and cell under a point, inverse of spanRect", () => {
    if (!right) throw new Error("no right block");
    expect(cellAt(blocks, right.x + 1.5, 2.2)).toEqual({ faceId: "r", col: 2, row: 1 });
    expect(cellAt(blocks, 0.5, 0.5)).toEqual({ faceId: "u", col: 0, row: 0 });
    expect(cellAt(blocks, 6.2, 0.5)).toBeNull(); // the gap
  });

  it("singleBlock is the face at the origin", () => {
    expect(singleBlock(face("u", null, 6, 3))).toEqual({
      blocks: [{ faceId: "u", label: "u", columns: 6, rows: 3, turned: false, x: 0, y: 0, width: 6, height: 3 }],
      width: 6,
      height: 3,
    });
  });
});
