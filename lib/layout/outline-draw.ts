// Drawing a custom outline, one tapped corner at a time (spec §10, setup).
// Corners land on whole inches, square up to the previous and first corner,
// and tapping the first corner closes the shape.

import { distance } from "./geometry";
import { MAX_COORD, SNAP_PX } from "./limits";
import { snapPoint, type Guide } from "./snap";
import type { Point } from "./types";

export type Drawing = { points: Point[] };
export type CornerResult = { drawing: Drawing; closed: Point[] | null; guides: Guide[] };

export const EMPTY_DRAWING: Drawing = { points: [] };

const clamp = (n: number) => Math.min(MAX_COORD, Math.max(0, n));

/** Where a corner would land: snapped to the first and last corners and the grid. */
export function previewCorner(drawing: Drawing, pointer: Point, scale: number): { point: Point; guides: Guide[] } {
  const anchors = [drawing.points[0], drawing.points.at(-1)].filter((p): p is Point => p !== undefined);
  const { point, guides } = snapPoint(pointer, { xs: anchors.map((p) => p.x), ys: anchors.map((p) => p.y) }, scale);
  return { point: { x: clamp(point.x), y: clamp(point.y) }, guides };
}

export function placeCorner(drawing: Drawing, pointer: Point, scale: number): CornerResult {
  const first = drawing.points[0];
  if (first && drawing.points.length >= 3 && distance(pointer, first) <= SNAP_PX / scale) {
    return { drawing: EMPTY_DRAWING, closed: drawing.points, guides: [] };
  }
  const { point, guides } = previewCorner(drawing, pointer, scale);
  const last = drawing.points.at(-1);
  // Before three corners the close check is skipped, so a tap back on the first corner must not add it again.
  const repeatsFirst = first && drawing.points.length < 3 && first.x === point.x && first.y === point.y;
  if ((last && last.x === point.x && last.y === point.y) || repeatsFirst) {
    return { drawing, closed: null, guides };
  }
  return { drawing: { points: [...drawing.points, point] }, closed: null, guides };
}

export function undoCorner(drawing: Drawing): Drawing {
  return { points: drawing.points.slice(0, -1) };
}
