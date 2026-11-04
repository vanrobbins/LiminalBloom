// A planogram's drawing space (spec §5.2, DECISIONS 10-08, 10-12). One unit is
// half a foot on both axes: a column is one unit wide and a row (a level, or a
// foot of a table top) is ROW_UNITS tall. A table set's lower tops join the
// upper on their side, as on the map; left and right lowers are turned so
// their columns run along the upper's edge. Storage is untouched: each block
// keeps its own face, columns and rows. The grid and the builder use only these
// units (one coordinate space: Merch Mobile's map mixed several).

import type { FaceSide, FixtureType, Side } from "@/lib/layout/types";
import type { Presentation } from "@/lib/products/footprint";
import type { Cells } from "@/lib/products/location-label";
import { readCells, type Spot } from "@/lib/products/location-words";

import type { PlanogramFace } from "./types";

/** Units per row: a row is a foot, a column half of one. */
export const ROW_UNITS = 2;
/** Half a foot of space between two tables, so they read as separate surfaces. */
export const SET_GAP = 1;

export type Block = {
  faceId: string;
  label: string;
  fixtureType: FixtureType;
  side: FaceSide;
  /** The lower table's side of its set; null for the planogram fixture's own faces. */
  setSide: Side | null;
  columns: number;
  rows: number;
  turned: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type GridLayout = { blocks: Block[]; width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

function block(face: PlanogramFace, turned: boolean, x: number, y: number): Block {
  return {
    faceId: face.faceId,
    label: face.label,
    fixtureType: face.fixtureType,
    side: face.side,
    setSide: face.setSide,
    columns: face.columns,
    rows: face.rows,
    turned,
    x,
    y,
    width: turned ? face.rows * ROW_UNITS : face.columns,
    height: turned ? face.columns : face.rows * ROW_UNITS,
  };
}

function shifted(blocks: Block[]): GridLayout {
  if (blocks.length === 0) return { blocks: [], width: 0, height: 0 };
  const minX = Math.min(...blocks.map((b) => b.x));
  const minY = Math.min(...blocks.map((b) => b.y));
  const moved = blocks.map((b) => ({ ...b, x: b.x - minX, y: b.y - minY }));
  return {
    blocks: moved,
    width: Math.max(...moved.map((b) => b.x + b.width)),
    height: Math.max(...moved.map((b) => b.y + b.height)),
  };
}

export function singleBlock(face: PlanogramFace): GridLayout {
  return shifted([block(face, false, 0, 0)]);
}

export function setBlocks(faces: readonly PlanogramFace[]): GridLayout {
  const upper = faces.find((f) => f.setSide === null);
  if (!upper) return shifted([]);
  const lower = (side: "front" | "back" | "left" | "right") => faces.find((f) => f.setSide === side);
  const upperHeight = upper.rows * ROW_UNITS;
  const blocks = [block(upper, false, 0, 0)];
  const back = lower("back");
  const front = lower("front");
  const left = lower("left");
  const right = lower("right");
  if (back) blocks.push(block(back, false, (upper.columns - back.columns) / 2, -back.rows * ROW_UNITS - SET_GAP));
  if (front) blocks.push(block(front, false, (upper.columns - front.columns) / 2, upperHeight + SET_GAP));
  if (left) blocks.push(block(left, true, -left.rows * ROW_UNITS - SET_GAP, (upperHeight - left.columns) / 2));
  if (right) blocks.push(block(right, true, upper.columns + SET_GAP, (upperHeight - right.columns) / 2));
  return shifted(blocks);
}

/**
 * A frame rack run (frame racks spec §5): every rack's rail in one row, in
 * reading order, half a foot apart. A corner shows in the block's label.
 */
export function runBlocks(faces: readonly PlanogramFace[]): GridLayout {
  let x = 0;
  const blocks = faces.map((face) => {
    const b = block(face, false, x, 0);
    x += face.columns + SET_GAP;
    return b;
  });
  return shifted(blocks);
}

/** The combined grid for a set or a run. */
export function combinedBlocks(scope: { isRun?: boolean; faces: readonly PlanogramFace[] }): GridLayout {
  return scope.isRun ? runBlocks(scope.faces) : setBlocks(scope.faces);
}

// A turned block's rows run from the table's own back (row 0), which is the
// edge against the upper on a left lower and the outer edge on a right lower.
export function spanRect(b: Block, c: Cells): Rect {
  return b.turned
    ? { x: b.x + (b.rows - c.row - c.rowSpan) * ROW_UNITS, y: b.y + c.col, width: c.rowSpan * ROW_UNITS, height: c.colSpan }
    : { x: b.x + c.col, y: b.y + c.row * ROW_UNITS, width: c.colSpan, height: c.rowSpan * ROW_UNITS };
}

export function blockAt(blocks: readonly Block[], x: number, y: number): Block | null {
  return blocks.find((b) => x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height) ?? null;
}

export function cellAt(blocks: readonly Block[], x: number, y: number): { faceId: string; col: number; row: number } | null {
  const b = blockAt(blocks, x, y);
  if (!b) return null;
  const dx = x - b.x;
  const dy = y - b.y;
  return b.turned
    ? { faceId: b.faceId, col: Math.floor(dy), row: b.rows - 1 - Math.floor(dx / ROW_UNITS) }
    : { faceId: b.faceId, col: Math.floor(dx), row: Math.floor(dy / ROW_UNITS) };
}

/** What location-words needs to read a placement on this face. */
export function spotOf(
  face: Pick<Block, "fixtureType" | "side" | "setSide" | "columns" | "rows">,
  item: Cells & { presentation: Presentation },
): Spot {
  return {
    fixtureType: face.fixtureType,
    side: face.side,
    columns: face.columns,
    rows: face.rows,
    presentation: item.presentation,
    cells: readCells({ col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan }, face),
  };
}
