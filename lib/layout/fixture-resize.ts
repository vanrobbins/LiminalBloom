// Resizing a fixture by its handles (spec §7). All rotation goes through frames.ts.

import { toLocal, toWorld } from "./frames";
import type { Rect } from "./fixtures";
import { MAX_FIXTURE_SIZE, MIN_FIXTURE_SIZE } from "./limits";
import type { Point, Side } from "./types";

export function clampSize(n: number): number {
  return Math.min(MAX_FIXTURE_SIZE, Math.max(MIN_FIXTURE_SIZE, Math.round(n)));
}

/** Drag the handle on `side` to `pointer`: that edge follows, the opposite edge stays. */
export function resizeFromHandle(
  f: Rect,
  side: Side,
  pointer: Point,
): { x: number; y: number; width: number; depth: number } {
  const local = toLocal(f, pointer);
  let width = f.width;
  let depth = f.depth;
  let cx = 0;
  let cy = 0;
  if (side === "right") {
    width = clampSize(local.x + f.width / 2);
    cx = -f.width / 2 + width / 2;
  } else if (side === "left") {
    width = clampSize(f.width / 2 - local.x);
    cx = f.width / 2 - width / 2;
  } else if (side === "front") {
    depth = clampSize(local.y + f.depth / 2);
    cy = -f.depth / 2 + depth / 2;
  } else {
    depth = clampSize(f.depth / 2 - local.y);
    cy = f.depth / 2 - depth / 2;
  }
  const centre = toWorld(f, { x: cx, y: cy });
  return { x: Math.round(centre.x), y: Math.round(centre.y), width, depth };
}

/** Lower tables stay centred on their side, so both ends move together; normalize() re-places them. */
export function resizeLowerTable(
  f: Rect,
  side: Side,
  pointer: Point,
): { width: number; depth: number } {
  if (side === "left" || side === "right") {
    return { width: clampSize(Math.abs(toLocal(f, pointer).x) * 2), depth: f.depth };
  }
  return { width: f.width, depth: resizeFromHandle(f, side, pointer).depth };
}
