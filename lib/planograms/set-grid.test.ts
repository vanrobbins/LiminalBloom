import { describe, expect, it } from "vitest";

import { cellAt, ROW_UNITS, SET_GAP, setBlocks, singleBlock, spanRect, spotOf } from "./set-grid";
import type { PlanogramFace } from "./types";

// Columns are half feet; a top's rows are feet, so a row is ROW_UNITS (2) units.
const face = (faceId: string, setSide: PlanogramFace["setSide"], columns: number, rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "T", fixtureType: "table", side: "top", setSide, label: faceId, columns, rows,
});

describe("setBlocks", () => {
  it("still shows the lower tops when the upper's top is switched off on the map", () => {
    const { blocks } = setBlocks([face("f", "front", 12, 2), face("b", "back", 6, 2)]);
    expect(blocks.map((b) => b.faceId)).toEqual(["f", "b"]);
    expect(blocks[1].x).toBe(12 + SET_GAP);
  });

  it("joins each lower top on its side of the upper, in half feet", () => {
    const { blocks, width, height } = setBlocks([face("u", null, 12, 3), face("f", "front", 12, 2), face("l", "left", 6, 2)]);
    const by = (id: string) => blocks.find((b) => b.faceId === id);
    // Left is turned: its 2 rows (4 units) run across, its 6 columns down.
    expect(by("l")).toMatchObject({ x: 0, y: 0, width: 2 * ROW_UNITS, height: 6, turned: true });
    expect(by("u")).toMatchObject({ x: 4 + SET_GAP, y: 0, width: 12, height: 3 * ROW_UNITS, turned: false });
    expect(by("f")).toMatchObject({ x: 4 + SET_GAP, y: 6 + SET_GAP, width: 12, height: 2 * ROW_UNITS, turned: false });
    expect(width).toBe(4 + SET_GAP + 12);
    expect(height).toBe(6 + SET_GAP + 4);
  });

  it("puts a back table above and shifts everything so nothing is negative", () => {
    const { blocks } = setBlocks([face("u", null, 12, 3), face("b", "back", 8, 2)]);
    expect(blocks.find((b) => b.faceId === "b")).toMatchObject({ x: 2, y: 0 });
    expect(blocks.find((b) => b.faceId === "u")).toMatchObject({ x: 0, y: 4 + SET_GAP });
  });
});

describe("spanRect and cellAt", () => {
  const { blocks } = setBlocks([face("u", null, 12, 3), face("r", "right", 6, 2)]);
  const right = blocks.find((b) => b.faceId === "r");

  it("draws a row two units tall and a column one unit wide", () => {
    const upper = blocks.find((b) => b.faceId === "u");
    if (!upper) throw new Error("no upper");
    expect(spanRect(upper, { col: 2, row: 1, colSpan: 4, rowSpan: 2 })).toEqual({ x: upper.x + 2, y: upper.y + 2, width: 4, height: 4 });
  });

  it("turns a right table's cells: columns run down, rows across", () => {
    if (!right) throw new Error("no right block");
    // Row 0 is the table's back: the outer edge of a right lower (2 rows = 4 units wide).
    expect(spanRect(right, { col: 1, row: 0, colSpan: 2, rowSpan: 1 })).toEqual({ x: right.x + ROW_UNITS, y: right.y + 1, width: 2, height: 2 });
  });

  it("finds the face and cell under a point, inverse of spanRect", () => {
    if (!right) throw new Error("no right block");
    expect(cellAt(blocks, right.x + 2.5, right.y + 2.2)).toEqual({ faceId: "r", col: 2, row: 0 });
    expect(cellAt(blocks, 0.5, 2.5)).toEqual({ faceId: "u", col: 0, row: 1 });
    expect(cellAt(blocks, 12.5, 0.5)).toBeNull(); // the gap
  });

  it("left lower: row 0 is next to the upper", () => {
    const set = setBlocks([face("u", null, 12, 3), face("l", "left", 6, 2)]);
    const left = set.blocks.find((b) => b.faceId === "l");
    if (!left) throw new Error("no left block");
    // The block's right edge touches the upper; row 0 is the strip against it.
    expect(spanRect(left, { col: 0, row: 0, colSpan: 1, rowSpan: 1 })).toEqual({ x: left.x + ROW_UNITS, y: left.y, width: 2, height: 1 });
    expect(spanRect(left, { col: 0, row: 1, colSpan: 1, rowSpan: 1 }).x).toBe(left.x);
    expect(cellAt(set.blocks, left.x + 3.5, left.y + 0.5)).toEqual({ faceId: "l", col: 0, row: 0 });
  });

  it("right lower: row 0 is the outer edge", () => {
    const set = setBlocks([face("u", null, 12, 3), face("r", "right", 6, 2)]);
    const r = set.blocks.find((b) => b.faceId === "r");
    if (!r) throw new Error("no right block");
    expect(spanRect(r, { col: 0, row: 0, colSpan: 1, rowSpan: 1 }).x).toBe(r.x + ROW_UNITS);
    expect(spanRect(r, { col: 0, row: 1, colSpan: 1, rowSpan: 1 }).x).toBe(r.x);
    // A two-row span covers the block's whole width.
    expect(spanRect(r, { col: 0, row: 0, colSpan: 1, rowSpan: 2 })).toEqual({ x: r.x, y: r.y, width: 4, height: 1 });
  });

  it("cellAt at the centre of every spanRect returns that cell, turned or not", () => {
    const set = setBlocks([face("u", null, 12, 3), face("f", "front", 8, 2), face("l", "left", 6, 2), face("r", "right", 6, 3)]);
    for (const b of set.blocks) {
      for (let row = 0; row < b.rows; row++) {
        for (let col = 0; col < b.columns; col++) {
          const r = spanRect(b, { col, row, colSpan: 1, rowSpan: 1 });
          expect(cellAt(set.blocks, r.x + r.width / 2, r.y + r.height / 2)).toEqual({ faceId: b.faceId, col, row });
        }
      }
    }
  });

  it("singleBlock is the face at the origin", () => {
    expect(singleBlock(face("u", null, 12, 3))).toEqual({
      blocks: [{ faceId: "u", label: "u", fixtureType: "table", side: "top", setSide: null, columns: 12, rows: 3, turned: false, x: 0, y: 0, width: 12, height: 6 }],
      width: 12,
      height: 6,
    });
  });

  it("gives a placement's spot for the words", () => {
    expect(spotOf(face("u", null, 12, 3), { col: 0, row: 0, colSpan: 4, rowSpan: 2, presentation: "folded" })).toEqual({
      fixtureType: "table", side: "top", columns: 12, rows: 3, presentation: "folded", cells: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
    });
  });

  it("reads a back lower table's spot from its outer edge", () => {
    expect(spotOf(face("b", "back", 12, 2), { col: 0, row: 0, colSpan: 4, rowSpan: 1, presentation: "folded" }).cells).toEqual({ col: 8, row: 1, colSpan: 4, rowSpan: 1 });
  });
});
