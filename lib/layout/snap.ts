// Snapping, kept pure (spec §6). A drag always snaps from where it started:
// `moving` are the points at the start and `delta` is how far the pointer has
// gone in total. Nothing is added to the previous frame's result, which is
// what made Merch Mobile's zone snapping glitch and collide.

import { corners } from "./fixtures";
import { normalizeAngle } from "./frames";
import { GRID_STEP, ROTATION_STEP, SNAP_PX } from "./limits";
import type { Layout, Point } from "./types";
import { OUTLINE_ID } from "./types";

export type SnapTargets = { xs: number[]; ys: number[] };
export type Guide = { axis: "x" | "y"; value: number };

export const NO_TARGETS: SnapTargets = { xs: [], ys: [] };

/** Lines through the outline's and zones' corners and square-on fixtures' edges, except the items being moved. */
export function targetsFor(layout: Layout, exclude: ReadonlySet<string>): SnapTargets {
  const points: Point[] = [];
  if (!exclude.has(OUTLINE_ID)) {
    points.push(...(layout.outline?.points ?? []));
  }
  for (const zone of layout.zones) {
    if (!exclude.has(zone.id)) points.push(...zone.points);
  }
  for (const fixture of layout.fixtures) {
    if (!exclude.has(fixture.id) && fixture.rotation % 90 === 0) points.push(...corners(fixture));
  }
  return {
    xs: [...new Set(points.map((p) => p.x))],
    ys: [...new Set(points.map((p) => p.y))],
  };
}

function snapAxis(
  values: number[],
  targets: number[],
  threshold: number,
): { correction: number; guide: number | null } {
  let best: { correction: number; guide: number } | null = null;
  for (const value of values) {
    for (const target of targets) {
      const correction = target - value;
      if (Math.abs(correction) <= threshold && (best === null || Math.abs(correction) < Math.abs(best.correction))) {
        best = { correction, guide: target };
      }
    }
  }
  if (best) {
    return best;
  }
  // No line near: fall back to the grid, measured from the first point.
  if (values.length === 0) {
    return { correction: 0, guide: null };
  }
  const off = Math.round(values[0] / GRID_STEP) * GRID_STEP - values[0];
  return { correction: Math.abs(off) <= threshold ? off : 0, guide: null };
}

function guidesFrom(x: number | null, y: number | null): Guide[] {
  const guides: Guide[] = [];
  if (x !== null) guides.push({ axis: "x", value: x });
  if (y !== null) guides.push({ axis: "y", value: y });
  return guides;
}

export function snapDelta(
  moving: Point[],
  delta: Point,
  targets: SnapTargets,
  scale: number,
  enabled = true,
): { delta: Point; guides: Guide[] } {
  if (!enabled || moving.length === 0) {
    return { delta: { x: Math.round(delta.x), y: Math.round(delta.y) }, guides: [] };
  }
  // The same 12 px on screen at every zoom.
  const threshold = SNAP_PX / scale;
  const x = snapAxis(moving.map((p) => p.x + delta.x), targets.xs, threshold);
  const y = snapAxis(moving.map((p) => p.y + delta.y), targets.ys, threshold);
  return {
    delta: { x: Math.round(delta.x + x.correction), y: Math.round(delta.y + y.correction) },
    guides: guidesFrom(x.guide, y.guide),
  };
}

/** A single free point, such as a corner being drawn; always lands on whole inches. */
export function snapPoint(
  p: Point,
  targets: SnapTargets,
  scale: number,
  enabled = true,
): { point: Point; guides: Guide[] } {
  if (!enabled) {
    return { point: { x: Math.round(p.x), y: Math.round(p.y) }, guides: [] };
  }
  const threshold = SNAP_PX / scale;
  const x = snapAxis([p.x], targets.xs, threshold);
  const y = snapAxis([p.y], targets.ys, threshold);
  return {
    point: { x: Math.round(p.x + x.correction), y: Math.round(p.y + y.correction) },
    guides: guidesFrom(x.guide, y.guide),
  };
}

export function snapAngle(degrees: number, enabled = true): number {
  return normalizeAngle(enabled ? Math.round(degrees / ROTATION_STEP) * ROTATION_STEP : degrees);
}
