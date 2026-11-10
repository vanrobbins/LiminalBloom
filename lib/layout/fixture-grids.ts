// The grid a face gets from its fixture's size (DECISIONS 10-10, 10-12).

import { COLUMNS_PER_FOOT } from "@/lib/feet";

import { FIXTURE_RULES } from "./fixtures";
import { MAX_GRID_COLUMNS, MAX_GRID_ROWS } from "./limits";
import type { Face, FaceSide, Fixture } from "./types";

/** Whole feet along a run, within the row limit. */
function feetAlong(inches: number): number {
  return Math.min(MAX_GRID_ROWS, Math.max(1, Math.round(inches / 12)));
}

/** Two columns a foot: exactly double the old count, so a migrated grid still reads as automatic. */
function columnsAlong(inches: number): number {
  return Math.min(MAX_GRID_COLUMNS, feetAlong(inches) * COLUMNS_PER_FOOT);
}

/** A surface seen from above: half-foot columns across, a row per foot of depth. */
export function gridForSurface(width: number, depth: number): { columns: number; rows: number } {
  return { columns: columnsAlong(width), rows: feetAlong(depth) };
}

/**
 * The grid a face gets from its fixture's size (DECISIONS 10-10, 10-12): two
 * columns per foot along the face. Fixtures have no height, so a standing face
 * keeps its type's rows.
 */
export function autoGrid(
  f: Pick<Fixture, "type" | "width" | "depth">,
  side: FaceSide,
): { columns: number; rows: number } {
  if (side === "top") return gridForSurface(f.width, f.depth);
  const run = side === "front" || side === "back" ? f.width : f.depth;
  return { columns: columnsAlong(run), rows: FIXTURE_RULES[f.type].defaultFaces[0]?.rows ?? 3 };
}

/** Nobody set this grid by hand: it is what the size implies. Not stored, so no migration. */
export function isAutoGrid(
  f: Pick<Fixture, "type" | "width" | "depth">,
  face: Pick<Face, "side" | "columns" | "rows">,
): boolean {
  const auto = autoGrid(f, face.side);
  return auto.columns === face.columns && auto.rows === face.rows;
}
