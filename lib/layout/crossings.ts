// Where segments and shapes cross, overlap and contain each other (spec §4, §6).
//
// Overlap and containment use "probes": each edge of one shape is cut where
// the other shape's edges meet it, and a point is placed a hair beside the
// middle of every piece. Two insides overlap exactly when an inside probe of
// one lands strictly inside the other. This holds for concave shapes, for
// shared edges (touching is not overlapping) and for identical shapes, which
// is where Merch Mobile's snapping and overlap checks went wrong.

import {
  add,
  classify,
  closestPointOnSegment,
  crossProduct,
  DISTANCE_TOLERANCE,
  dot,
  edgesOf,
  length,
  lerp,
  PARAM_TOLERANCE,
  scale,
  signedArea,
  subtract,
} from "./geometry";
import { ROTATED_EPSILON } from "./limits";
import type { Point } from "./types";

export type Crossing =
  | { kind: "none" }
  | { kind: "point"; at: Point; proper: boolean }
  | { kind: "overlap"; from: Point; to: Point };

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
