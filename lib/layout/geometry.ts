// Plane geometry on store inches (spec §4, §6). Whole-number corners make
// the crossing tests exact; rotated fixtures bring fractions, which the small
// tolerances below absorb. Crossings, overlap and containment live in
// crossings.ts.

import type { Point } from "./types";

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Where = "inside" | "outside" | "boundary";

/** Closer than this to a line counts as on it. */
export const DISTANCE_TOLERANCE = 1e-6;
/** Positions along a segment (0 to 1) closer than this are the same place. */
export const PARAM_TOLERANCE = 1e-9;

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function crossProduct(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function length(p: Point): number {
  return Math.hypot(p.x, p.y);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Positive when the corners run anticlockwise in the usual maths sense. */
export function signedArea(points: Point[]): number {
  let sum = 0;
  for (const [a, b] of edgesOf(points)) {
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function area(points: Point[]): number {
  return Math.abs(signedArea(points));
}

export function centroid(points: Point[]): Point {
  const twiceArea = signedArea(points) * 2;
  if (Math.abs(twiceArea) < PARAM_TOLERANCE || points.length === 0) {
    const n = Math.max(points.length, 1);
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / n,
      y: points.reduce((sum, p) => sum + p.y, 0) / n,
    };
  }
  let x = 0;
  let y = 0;
  for (const [a, b] of edgesOf(points)) {
    const f = a.x * b.y - b.x * a.y;
    x += (a.x + b.x) * f;
    y += (a.y + b.y) * f;
  }
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
}

export function bounds(points: Point[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

/** A cheap first test before the exact ones. Touching counts. */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

export function translate(points: Point[], delta: Point): Point[] {
  return points.map((p) => add(p, delta));
}

/** Each edge as [from, to], closing the shape. */
export function edgesOf(points: Point[]): [Point, Point][] {
  return points.map((p, i) => [p, points[(i + 1) % points.length]]);
}

export function closestPointOnSegment(
  p: Point,
  a: Point,
  b: Point,
): { point: Point; t: number; distance: number } {
  const ab = subtract(b, a);
  const lengthSquared = dot(ab, ab);
  const t =
    lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, dot(subtract(p, a), ab) / lengthSquared));
  const point = lerp(a, b, t);
  return { point, t, distance: distance(p, point) };
}

export function classify(p: Point, polygon: Point[]): Where {
  for (const [a, b] of edgesOf(polygon)) {
    if (closestPointOnSegment(p, a, b).distance <= DISTANCE_TOLERANCE) {
      return "boundary";
    }
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y) {
      const x = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (p.x < x) {
        inside = !inside;
      }
    }
  }
  return inside ? "inside" : "outside";
}

/** A point inside the shape, for its label: the centroid if that is inside, else the middle of the widest span. */
export function interiorPoint(points: Point[]): Point {
  const middle = centroid(points);
  if (classify(middle, points) === "inside") {
    return middle;
  }
  const { minY, maxY } = bounds(points);
  const y = (minY + maxY) / 2;
  const xs: number[] = [];
  for (const [a, b] of edgesOf(points)) {
    if (a.y > y !== b.y > y) {
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
  }
  xs.sort((p, q) => p - q);
  let best = { x: middle.x, width: -1 };
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > best.width) {
      best = { x: (xs[i] + xs[i + 1]) / 2, width: xs[i + 1] - xs[i] };
    }
  }
  return { x: best.x, y };
}
