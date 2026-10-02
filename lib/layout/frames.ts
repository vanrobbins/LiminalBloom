// The only rotation code in the app (spec §6; Merch Mobile's "rotation-aware
// hit boxes" and "rotation-aware resize" fixes came from rotation being done
// in several places). A fixture's own frame has its centre at 0,0, its width
// along x and its front edge at +y. Rotation turns that frame clockwise on
// the map, where y grows downward, as in SVG.

import type { Point } from "./types";

export type Pose = { x: number; y: number; rotation: number };

/** Whole degrees, 0–359. */
export function normalizeAngle(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360;
}

/** Exact values at quarter turns, so 90° leaves no 6e-17 behind. */
function cosSin(degrees: number): [number, number] {
  const d = ((degrees % 360) + 360) % 360;
  if (d === 0) return [1, 0];
  if (d === 90) return [0, 1];
  if (d === 180) return [-1, 0];
  if (d === 270) return [0, -1];
  const radians = (d * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
}

export function rotate(p: Point, degrees: number): Point {
  const [c, s] = cosSin(degrees);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function toWorld(pose: Pose, local: Point): Point {
  const turned = rotate(local, pose.rotation);
  return { x: turned.x + pose.x, y: turned.y + pose.y };
}

export function toLocal(pose: Pose, world: Point): Point {
  return rotate({ x: world.x - pose.x, y: world.y - pose.y }, -pose.rotation);
}

/** The rotation that points a fixture's back toward `to`: 0 when `to` is straight up. */
export function angleTowards(from: Point, to: Point): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 90;
}
