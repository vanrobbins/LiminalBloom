// Entrances are openings in the outline's walls (spec §5). An entrance is its
// centre and width; it always sits on the nearest wall. normalize() puts a
// stray one back, and validate() flags one that cannot fit.

import { add, closestPointOnSegment, distance, edgesOf, lerp, scale, subtract } from "./geometry";
import { MAX_ENTRANCE_WIDTH, MIN_ENTRANCE_WIDTH } from "./limits";
import type { Entrance, Point } from "./types";

/** Rounding to whole inches on a slanted wall can move a point up to ~0.7 in off it. */
export const ON_WALL_TOLERANCE = 1;

export type Wall = { index: number; a: Point; b: Point; t: number; distance: number; length: number };

export function nearestWall(outline: Point[], p: Point): Wall | null {
  let best: Wall | null = null;
  const edges = edgesOf(outline);
  for (let index = 0; index < edges.length; index++) {
    const [a, b] = edges[index];
    const hit = closestPointOnSegment(p, a, b);
    if (best === null || hit.distance < best.distance) {
      best = { index, a, b, t: hit.t, distance: hit.distance, length: distance(a, b) };
    }
  }
  return best;
}

/** Whether an opening this wide, centred where the wall's `t` says, stays on the wall. */
export function fitsOnWall(wall: Wall, width: number): boolean {
  if (wall.length === 0) {
    return false;
  }
  const half = width / 2 / wall.length;
  const slack = ON_WALL_TOLERANCE / wall.length;
  return wall.t - half >= -slack && wall.t + half <= 1 + slack;
}

export function isOnWall(e: Entrance, outline: Point[]): boolean {
  const wall = nearestWall(outline, e);
  return wall !== null && wall.distance <= ON_WALL_TOLERANCE && fitsOnWall(wall, e.width);
}

/** Back onto the nearest wall, slid along it so it fits if the wall is long enough. */
export function placeOnWall(e: Entrance, outline: Point[]): Entrance {
  const wall = nearestWall(outline, e);
  if (wall === null || (wall.distance <= ON_WALL_TOLERANCE && fitsOnWall(wall, e.width))) {
    return e;
  }
  const half = wall.length > 0 ? e.width / 2 / wall.length : 0;
  const t = half <= 0.5 ? Math.min(1 - half, Math.max(half, wall.t)) : 0.5;
  const p = lerp(wall.a, wall.b, t);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  return x === e.x && y === e.y ? e : { ...e, x, y };
}

/** The opening's two ends: [toward the wall's start, toward its end]. */
export function entranceEnds(e: Entrance, outline: Point[]): [Point, Point] | null {
  const wall = nearestWall(outline, e);
  if (wall === null || wall.length === 0) {
    return null;
  }
  const direction = scale(subtract(wall.b, wall.a), 1 / wall.length);
  const centre = lerp(wall.a, wall.b, wall.t);
  return [add(centre, scale(direction, -e.width / 2)), add(centre, scale(direction, e.width / 2))];
}

/** Where along its wall an entrance runs, in inches from the wall's start. */
export function wallSpan(e: Entrance, outline: Point[]): { index: number; from: number; to: number } | null {
  const wall = nearestWall(outline, e);
  if (wall === null) {
    return null;
  }
  const centre = wall.t * wall.length;
  return { index: wall.index, from: centre - e.width / 2, to: centre + e.width / 2 };
}

/** Drag one end along the wall; the other end stays where it is. */
export function dragEntranceEnd(
  e: Entrance,
  outline: Point[],
  end: "start" | "end",
  pointer: Point,
): { x: number; y: number; width: number } {
  const wall = nearestWall(outline, e);
  if (wall === null || wall.length === 0) {
    return { x: e.x, y: e.y, width: e.width };
  }
  // If the wall is shorter than the minimum width, centre it like placeOnWall does.
  if (wall.length < MIN_ENTRANCE_WIDTH) {
    const p = lerp(wall.a, wall.b, 0.5);
    return { x: Math.round(p.x), y: Math.round(p.y), width: MIN_ENTRANCE_WIDTH };
  }
  // The "end" end sits at t + half and the "start" end at t − half; the one
  // not being dragged stays put.
  const half = e.width / 2 / wall.length;
  const fixed = end === "end" ? wall.t - half : wall.t + half;
  const moving = closestPointOnSegment(pointer, wall.a, wall.b).t;
  const width = Math.min(
    MAX_ENTRANCE_WIDTH,
    Math.max(MIN_ENTRANCE_WIDTH, Math.round(Math.abs(moving - fixed) * wall.length)),
  );
  const direction = moving >= fixed ? 1 : -1;
  const wSpan = width / wall.length;
  // Slide the opening along the wall so both ends stay within [0, 1].
  let fixedAdjusted = fixed;
  if (direction >= 0) {
    if (fixed + wSpan > 1) {
      fixedAdjusted = 1 - wSpan;
    } else if (fixed < 0) {
      fixedAdjusted = 0;
    }
  } else {
    if (fixed - wSpan < 0) {
      fixedAdjusted = wSpan;
    } else if (fixed > 1) {
      fixedAdjusted = 1;
    }
  }
  const centre = lerp(wall.a, wall.b, fixedAdjusted + (direction * wSpan) / 2);
  return { x: Math.round(centre.x), y: Math.round(centre.y), width };
}
