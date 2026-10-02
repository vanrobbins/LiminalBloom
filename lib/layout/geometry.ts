// Plane geometry on store inches (spec §4, §6). Whole-number corners make
// the crossing tests exact; rotated fixtures bring fractions, which the small
// tolerances below absorb.
//
// Overlap and containment use "probes": each edge of one shape is cut where
// the other shape's edges meet it, and a point is placed a hair beside the
// middle of every piece. Two insides overlap exactly when an inside probe of
// one lands strictly inside the other. This holds for concave shapes, for
// shared edges (touching is not overlapping) and for identical shapes, which
// is where Merch Mobile's snapping and overlap checks went wrong.

import { ROTATED_EPSILON } from "./limits";
import type { Point } from "./types";

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Where = "inside" | "outside" | "boundary";
export type Crossing =
  | { kind: "none" }
  | { kind: "point"; at: Point; proper: boolean }
  | { kind: "overlap"; from: Point; to: Point };

/** Closer than this to a line counts as on it. */
const DISTANCE_TOLERANCE = 1e-6;
/** Positions along a segment (0 to 1) closer than this are the same place. */
const PARAM_TOLERANCE = 1e-9;

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

export function intersect(a: Point, b: Point, c: Point, d: Point): Crossing {
  const r = subtract(b, a);
  const s = subtract(d, c);
  const ac = subtract(c, a);
  const rLength = length(r);
  const sLength = length(s);

  if (rLength === 0 || sLength === 0) {
    // A zero-length segment is a point; it meets the other only by lying on it.
    const point = rLength === 0 ? a : c;
    const [from, to] = rLength === 0 ? [c, d] : [a, b];
    return closestPointOnSegment(point, from, to).distance <= DISTANCE_TOLERANCE
      ? { kind: "point", at: point, proper: false }
      : { kind: "none" };
  }

  const denominator = crossProduct(r, s);
  if (Math.abs(denominator) <= PARAM_TOLERANCE * rLength * sLength) {
    // Parallel. Collinear only if c lies on the line through a and b.
    if (Math.abs(crossProduct(ac, r)) / rLength > DISTANCE_TOLERANCE) {
      return { kind: "none" };
    }
    const rr = dot(r, r);
    const t0 = dot(ac, r) / rr;
    const t1 = t0 + dot(s, r) / rr;
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    if (hi < lo - PARAM_TOLERANCE) {
      return { kind: "none" };
    }
    if (hi - lo <= PARAM_TOLERANCE) {
      return { kind: "point", at: lerp(a, b, lo), proper: false };
    }
    return { kind: "overlap", from: lerp(a, b, lo), to: lerp(a, b, hi) };
  }

  const t = crossProduct(ac, s) / denominator;
  const u = crossProduct(ac, r) / denominator;
  if (
    t < -PARAM_TOLERANCE ||
    t > 1 + PARAM_TOLERANCE ||
    u < -PARAM_TOLERANCE ||
    u > 1 + PARAM_TOLERANCE
  ) {
    return { kind: "none" };
  }
  const proper =
    t > PARAM_TOLERANCE &&
    t < 1 - PARAM_TOLERANCE &&
    u > PARAM_TOLERANCE &&
    u < 1 - PARAM_TOLERANCE;
  return { kind: "point", at: lerp(a, b, t), proper };
}

/** True for any shape that is not simple, including a repeated corner. */
export function selfIntersects(points: Point[]): boolean {
  const edges = edgesOf(points);
  const n = edges.length;
  if (n < 3) {
    return false;
  }
  if (edges.some(([a, b]) => a.x === b.x && a.y === b.y)) {
    return true;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const hit = intersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1]);
      if (hit.kind === "none") {
        continue;
      }
      // Neighbouring edges share one corner; anything more is a fold-back.
      const neighbours = j === i + 1 || (i === 0 && j === n - 1);
      if (!neighbours || hit.kind === "overlap") {
        return true;
      }
    }
  }
  return false;
}

/** Each edge of `polygon`, cut wherever an edge of `other` meets it. */
function piecesOf(polygon: Point[], other: Point[]): [Point, Point][] {
  const pieces: [Point, Point][] = [];
  for (const [a, b] of edgesOf(polygon)) {
    const ab = subtract(b, a);
    const lengthSquared = dot(ab, ab);
    if (lengthSquared === 0) {
      continue;
    }
    const paramOf = (p: Point) => dot(subtract(p, a), ab) / lengthSquared;
    const cuts = [0, 1];
    for (const [c, d] of edgesOf(other)) {
      const hit = intersect(a, b, c, d);
      if (hit.kind === "point") {
        cuts.push(paramOf(hit.at));
      } else if (hit.kind === "overlap") {
        cuts.push(paramOf(hit.from), paramOf(hit.to));
      }
    }
    cuts.sort((x, y) => x - y);
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] - cuts[i - 1] > PARAM_TOLERANCE) {
        pieces.push([lerp(a, b, cuts[i - 1]), lerp(a, b, cuts[i])]);
      }
    }
  }
  return pieces;
}

/** A point just beside the middle of every piece of `polygon`'s outline, inside it or outside it. */
export function probes(polygon: Point[], other: Point[], side: "in" | "out"): Point[] {
  // With a positive signed area the inside is to the left of every edge.
  const inward = signedArea(polygon) > 0 ? 1 : -1;
  const sign = side === "in" ? inward : -inward;
  return piecesOf(polygon, other).map(([p, q]) => {
    const d = subtract(q, p);
    const len = length(d);
    const normal = { x: (-d.y / len) * sign, y: (d.x / len) * sign };
    return add(lerp(p, q, 0.5), scale(normal, ROTATED_EPSILON));
  });
}

/** Whether the insides overlap. Shared edges and corners are touching, not overlapping. */
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  return (
    probes(a, b, "in").some((p) => classify(p, b) === "inside") ||
    probes(b, a, "in").some((p) => classify(p, a) === "inside")
  );
}

/** Whether `inner` lies within `outer`; touching the edge is fine. */
export function polygonContains(outer: Point[], inner: Point[]): boolean {
  if (probes(inner, outer, "in").some((p) => classify(p, outer) === "outside")) {
    return false;
  }
  return !probes(outer, inner, "out").some((p) => classify(p, inner) === "inside");
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
