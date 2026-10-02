// The one place that knows about pixels (spec §4). Everything else works in
// store inches; this converts between the two. Merch Mobile's "drag-to-add
// view transform" and "zones off-screen on phone" bugs came from converting
// in several places.
//
// `x`, `y` is the world point at the screen's top-left; `scale` is screen
// pixels per inch.

import type { Bounds } from "./geometry";
import type { Point } from "./types";

export type Camera = { x: number; y: number; scale: number };
export type Viewport = { width: number; height: number };
export type ScaleLimits = { min: number; max: number };

/** 4 px per inch: close enough to work a single grid cell by touch. */
export const MAX_SCALE = 4;
const MIN_FIT_SCALE = 0.001;

export function worldToScreen(c: Camera, p: Point): Point {
  return { x: (p.x - c.x) * c.scale, y: (p.y - c.y) * c.scale };
}

export function screenToWorld(c: Camera, p: Point): Point {
  return { x: p.x / c.scale + c.x, y: p.y / c.scale + c.y };
}

export function panBy(c: Camera, dx: number, dy: number): Camera {
  return { ...c, x: c.x - dx / c.scale, y: c.y - dy / c.scale };
}

/** Zoom around a screen point, which stays under the fingers. */
export function zoomAt(c: Camera, screen: Point, factor: number, limits: ScaleLimits): Camera {
  const scale = Math.min(limits.max, Math.max(limits.min, c.scale * factor));
  const anchor = screenToWorld(c, screen);
  return { scale, x: anchor.x - screen.x / scale, y: anchor.y - screen.y / scale };
}

/** The whole of `b` in view, centred, with some room around it. */
export function fit(b: Bounds, v: Viewport, padding = 24): Camera {
  const width = Math.max(b.maxX - b.minX, 1);
  const height = Math.max(b.maxY - b.minY, 1);
  // A view not yet measured (0 × 0) still gets a finite camera; the real
  // size arrives a moment later and fits again (Review Focus 3).
  const roomX = Math.max(v.width - 2 * padding, 1);
  const roomY = Math.max(v.height - 2 * padding, 1);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_FIT_SCALE, Math.min(roomX / width, roomY / height)));
  return {
    scale,
    x: (b.minX + b.maxX) / 2 - v.width / 2 / scale,
    y: (b.minY + b.maxY) / 2 - v.height / 2 / scale,
  };
}

export function scaleLimits(store: Bounds, v: Viewport): ScaleLimits {
  return { min: Math.min(fit(store, v).scale / 2, MAX_SCALE), max: MAX_SCALE };
}

export function viewCentre(c: Camera, v: Viewport): Point {
  return screenToWorld(c, { x: v.width / 2, y: v.height / 2 });
}

export function centreOn(c: Camera, v: Viewport, p: Point): Camera {
  return { ...c, x: p.x - v.width / 2 / c.scale, y: p.y - v.height / 2 / c.scale };
}
