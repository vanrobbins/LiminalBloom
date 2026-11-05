// Curved wall bays (curved wall bays spec). A bay's `curve` is how far the
// middle of its centre line sits from the straight line between its ends,
// positive toward the front. `width` is the length along the curve and `x, y`
// the middle of that straight line, so changing the curve never moves the pose.
// The shape is a circular band; a curve of 0 is the fixture's own rectangle,
// with the exact rectangle maths from fixtures.ts.

import { clampSize, corners, distanceToRect, rectsOverlap, type Rect } from "./fixtures";
import { toLocal, toWorld } from "./frames";
import { bounds, classify, closestPointOnSegment, edgesOf, polygonsOverlap } from "./geometry";
import { CURVE_SNAP, MAX_CURVE, MIN_CURVE_RADIUS } from "./limits";
import type { Point } from "./types";

export type Curved = Rect & { curve: number };

type Arc = { radius: number; half: number; sign: number };

/** Arcs are cut this fine for collisions: within an inch of the true curve at any size. */
const STEP = (7.5 * Math.PI) / 180;
const BISECTIONS = 48;

/** Radius and half-angle of the centre line. A curve past a half circle is held at one until validate() refuses it. */
function arcOf(width: number, curve: number): Arc | null {
  if (curve === 0 || width <= 0) return null;
  const ratio = Math.abs(curve) / width;
  let low = 0;
  let high = Math.PI / 2;
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (low + high) / 2;
    if ((1 - Math.cos(mid)) / (2 * mid) < ratio) low = mid;
    else high = mid;
  }
  return { radius: width / (2 * high), half: high, sign: Math.sign(curve) };
}

/** A point on the band in the fixture's frame: `angle` along it from the middle, `offset` toward the front. */
function pointOn({ radius, half, sign }: Arc, angle: number, offset: number): Point {
  const r = radius + sign * offset;
  return { x: r * Math.sin(angle), y: sign * (r * Math.cos(angle) - radius * Math.cos(half)) };
}

/** The most a bay this size can curve: a half circle, with room for the inner edge. */
export function maxCurve(width: number, depth: number): number {
  const half = Math.min(Math.PI / 2, width / (2 * (depth / 2 + MIN_CURVE_RADIUS)));
  const radius = width / (2 * half);
  return Math.min(MAX_CURVE, Math.floor(radius * (1 - Math.cos(half))));
}

/** The shape on the map: its corners when straight, the band as a polygon when curved. */
export function footprint(f: Curved): Point[] {
  const arc = arcOf(f.width, f.curve);
  if (!arc) return corners(f);
  const steps = Math.max(1, Math.ceil((2 * arc.half) / STEP));
  const angles = Array.from({ length: steps + 1 }, (_, i) => -arc.half + (2 * arc.half * i) / steps);
  const back = angles.map((a) => pointOn(arc, a, -f.depth / 2));
  const front = angles.map((a) => pointOn(arc, a, f.depth / 2)).reverse();
  return [...back, ...front].map((p) => toWorld(f, p));
}

/** Touching is not overlapping, for straight and curved alike. */
export function fixturesOverlap(a: Curved, b: Curved): boolean {
  if (a.curve === 0 && b.curve === 0) return rectsOverlap(a, b);
  return polygonsOverlap(footprint(a), footprint(b));
}

/** 0 on the fixture, otherwise the gap to its nearest edge. */
export function distanceToFixture(f: Curved, p: Point): number {
  if (f.curve === 0) return distanceToRect(f, p);
  const shape = footprint(f);
  if (classify(p, shape) !== "outside") return 0;
  return Math.min(...edgesOf(shape).map(([a, b]) => closestPointOnSegment(p, a, b).distance));
}

/** Half the straight distance between the ends, where the end handles sit. */
export function halfChord(f: Pick<Curved, "width" | "curve">): number {
  const arc = arcOf(f.width, f.curve);
  return arc ? arc.radius * Math.sin(arc.half) : f.width / 2;
}

/** How far the middle of the bay is from `x, y`, toward the front. */
export function middleOffset(f: Pick<Curved, "width" | "curve">): number {
  const arc = arcOf(f.width, f.curve);
  return arc ? arc.sign * arc.radius * (1 - Math.cos(arc.half)) : 0;
}

/** The middle of the fixture on the map. Always on it, unlike `x, y` when it curves. */
export function middleOf(f: Curved): Point {
  return f.curve === 0 ? { x: f.x, y: f.y } : toWorld(f, { x: 0, y: middleOffset(f) });
}

/** What snapping lines up: the corners, or a curved bay's bounding box, so its back can meet a wall. */
export function snapPoints(f: Curved): Point[] {
  if (f.curve === 0) return corners(f);
  const { minX, minY, maxX, maxY } = bounds(footprint(f));
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/** Drag the curve handle from `origin` to `pointer`: the middle follows, up to the limit. */
export function bendFromHandle(f: Curved, origin: Point, pointer: Point, snapping: boolean): number {
  const limit = maxCurve(f.width, f.depth);
  const moved = toLocal(f, pointer).y - toLocal(f, origin).y;
  const curve = Math.min(limit, Math.max(-limit, Math.round(f.curve + moved)));
  // Adding 0 turns Math.round's -0 into 0.
  return snapping && Math.abs(curve) <= CURVE_SNAP ? 0 : curve + 0;
}

/** Drag an end of a curved bay: both ends move together and the curve stays, so the length is what changes. */
export function resizeCurved(f: Curved, pointer: Point): number {
  const sagitta = Math.abs(f.curve);
  // Closer in than this would be past a half circle.
  const chord = Math.max(Math.abs(toLocal(f, pointer).x), sagitta);
  const radius = (chord * chord + sagitta * sagitta) / (2 * sagitta);
  return clampSize(2 * radius * Math.asin(Math.min(1, chord / radius)));
}

function arcTo(arc: Arc, radius: number, to: Point, forward: boolean): string {
  // Left to right is anticlockwise on screen when the middle bends toward the front.
  const sweep = arc.sign > 0 === forward ? 0 : 1;
  return `A ${radius} ${radius} 0 0 ${sweep} ${to.x} ${to.y}`;
}

/** One edge of the band as an SVG path in the fixture's frame, `inset` inches short of each end. */
export function edgePath(f: Pick<Curved, "width" | "curve">, offset: number, inset = 0): string {
  const arc = arcOf(f.width, f.curve);
  if (!arc) return "";
  const angle = Math.max(0, arc.half - inset / arc.radius);
  const start = pointOn(arc, -angle, offset);
  return `M ${start.x} ${start.y} ${arcTo(arc, arc.radius + arc.sign * offset, pointOn(arc, angle, offset), true)}`;
}

/** The whole band as an SVG path in the fixture's frame. */
export function bandPath(f: Pick<Curved, "width" | "depth" | "curve">): string {
  const arc = arcOf(f.width, f.curve);
  if (!arc) return "";
  const back = -f.depth / 2;
  const front = f.depth / 2;
  const frontRight = pointOn(arc, arc.half, front);
  const frontLeft = pointOn(arc, -arc.half, front);
  return `${edgePath(f, back)} L ${frontRight.x} ${frontRight.y} ${arcTo(arc, arc.radius + arc.sign * front, frontLeft, false)} Z`;
}
