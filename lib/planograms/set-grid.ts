// A table set's combined view (spec §5.2, DECISIONS 10-08): the upper's top in
// the middle, each lower top joined on its side at the same cell size, as on
// the map. Left and right lowers are turned so their columns run along the
// upper's edge. Units are cells; the grid component scales them. Storage is
// untouched: each block keeps its own face and cell names.

import type { Cells } from "@/lib/products/location-label";

import type { PlanogramFace } from "./types";

/** Cells of space between two tables, so they read as separate surfaces. */
export const SET_GAP = 0.5;

export type Block = {
  faceId: string;
  label: string;
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
    columns: face.columns,
    rows: face.rows,
    turned,
    x,
    y,
    width: turned ? face.rows : face.columns,
    height: turned ? face.columns : face.rows,
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
  const blocks = [block(upper, false, 0, 0)];
  const back = lower("back");
  const front = lower("front");
  const left = lower("left");
  const right = lower("right");
  if (back) blocks.push(block(back, false, (upper.columns - back.columns) / 2, -back.rows - SET_GAP));
  if (front) blocks.push(block(front, false, (upper.columns - front.columns) / 2, upper.rows + SET_GAP));
  if (left) blocks.push(block(left, true, -left.rows - SET_GAP, (upper.rows - left.columns) / 2));
  if (right) blocks.push(block(right, true, upper.columns + SET_GAP, (upper.rows - right.columns) / 2));
  return shifted(blocks);
}

export function spanRect(b: Block, c: Cells): Rect {
  return b.turned
    ? { x: b.x + c.row, y: b.y + c.col, width: c.rowSpan, height: c.colSpan }
    : { x: b.x + c.col, y: b.y + c.row, width: c.colSpan, height: c.rowSpan };
}

export function cellAt(blocks: readonly Block[], x: number, y: number): { faceId: string; col: number; row: number } | null {
  for (const b of blocks) {
    if (x < b.x || y < b.y || x >= b.x + b.width || y >= b.y + b.height) continue;
    const dx = Math.floor(x - b.x);
    const dy = Math.floor(y - b.y);
    return b.turned ? { faceId: b.faceId, col: dy, row: dx } : { faceId: b.faceId, col: dx, row: dy };
  }
  return null;
}
