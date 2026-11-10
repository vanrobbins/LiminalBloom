// Easier curving (run joins spec §3). The curve handle snaps to the curves
// that make a bay's end run smoothly into a nearby wall bay, and "Fit to
// corner" bends a bay into the quarter circle between two bays at a corner.
// Neither links anything: runs are only made explicitly (DECISIONS 11-09).

import { maxCurve } from "./curves";
import { normalizeAngle, rotate } from "./frames";
import { MIN_CURVE_RADIUS } from "./limits";
import { endsOf } from "./runs";
import type { Fixture, Layout, Point } from "./types";

/** How close a bent end must come to a neighbour's end to count as meeting it. */
export const MEET_REACH = 12;
/** How far, in inches of curve, the handle is pulled onto a meeting curve. */
export const BEND_SNAP = 3;
/** The grid unit: a fitted bay's width is a whole number of these. */
const HALF_FOOT = 6;

const RAD = Math.PI / 180;
const angleDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;
const gap = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
const bayEnds = (f: Fixture) => endsOf({ ...f, type: "wall_bay" });

/** The signed curve whose centre line of `width` turns each end by `half` degrees (positive: toward the front). */
function curveFor(width: number, half: number): number {
  const h = Math.abs(half) * RAD;
  if (h < 1e-9) return 0;
  return Math.round(Math.sign(half) * (width / (2 * h)) * (1 - Math.cos(h)));
}

export type Meeting = { curve: number; meets: string };

/** Every curve that makes one of this bay's ends run straight on into another wall bay's end, within reach. */
export function meetingCurves(layout: Layout, f: Fixture): Meeting[] {
  const limit = maxCurve(f.width, f.depth);
  const found: Meeting[] = [];
  for (const g of layout.fixtures) {
    if (g.id === f.id || g.type !== "wall_bay") continue;
    const theirs = bayEnds(g);
    // f's right end into g's left end: f.rotation − half = g's left direction. f's left end from g's right: f.rotation + half.
    const tries: [number, "left" | "right", Point][] = [
      [angleDiff(f.rotation, theirs.left.dir), "right", theirs.left.at],
      [angleDiff(theirs.right.dir, f.rotation), "left", theirs.right.at],
    ];
    for (const [half, end, at] of tries) {
      if (Math.abs(half) >= 90) continue;
      const curve = curveFor(f.width, half);
      if (curve === 0 || Math.abs(curve) > limit) continue;
      if (gap(bayEnds({ ...f, curve })[end].at, at) <= MEET_REACH) found.push({ curve, meets: g.id });
    }
  }
  return found;
}

/** The handle's curve, pulled onto a meeting curve within BEND_SNAP; which bay it meets, if any. */
export function snapBend(layout: Layout, f: Fixture, curve: number, snapping: boolean): { curve: number; meets: string | null } {
  if (!snapping || f.type !== "wall_bay") return { curve, meets: null };
  const near = meetingCurves(layout, f)
    .filter((m) => Math.abs(m.curve - curve) <= BEND_SNAP)
    .sort((a, b) => Math.abs(a.curve - curve) - Math.abs(b.curve - curve))[0];
  return near ? { curve: near.curve, meets: near.meets } : { curve, meets: null };
}

type FitChanges = Pick<Fixture, "x" | "y" | "rotation" | "width" | "curve">;
export type CornerFit = { changes: FitChanges; meets: string[]; gap: number } | { refusal: string };

/** Where two end lines cross: `a` going forward along `da`, `b` coming in along `db`. Distances along each, or null if parallel. */
function crossing(a: Point, da: number, b: Point, db: number): { ta: number; tb: number } | null {
  const u = { x: Math.cos(da * RAD), y: Math.sin(da * RAD) };
  const v = { x: Math.cos(db * RAD), y: Math.sin(db * RAD) };
  const cross = u.x * v.y - u.y * v.x;
  if (Math.abs(cross) < 1e-9) return null;
  const w = { x: b.x - a.x, y: b.y - a.y };
  // a + ta·u = b − tb·v
  return { ta: (w.x * v.y - w.y * v.x) / cross, tb: (u.x * w.y - u.y * w.x) / cross };
}

/**
 * Fit to corner (run joins spec §3.2): two other wall bays end at a 90° corner
 * near this one; bend it into the quarter circle between them. It meets the
 * nearer bay exactly; its width rounds down to the half foot, so on the far
 * side it can only stop short (`gap`), never overlap. Null when no corner is near.
 */
export function cornerFit(layout: Layout, id: string): CornerFit | null {
  const f = layout.fixtures.find((x) => x.id === id);
  if (!f || f.type !== "wall_bay") return null;
  const bays = layout.fixtures.filter((g) => g.type === "wall_bay" && g.id !== id);
  const middle = { x: f.x, y: f.y };
  let best: { a: Fixture; b: Fixture; ta: number; tb: number; turn: number; corner: Point } | null = null;
  for (const a of bays) {
    for (const b of bays) {
      if (a.id === b.id) continue;
      const from = bayEnds(a).right;
      const to = bayEnds(b).left;
      const turn = angleDiff(to.dir, from.dir);
      if (Math.abs(Math.abs(turn) - 90) > 1) continue;
      const cross = crossing(from.at, from.dir, to.at, to.dir);
      // Both ends short of the corner (an inch past it counts: rounding, or a bay just over the line).
      if (!cross || cross.ta < -1 || cross.tb < -1) continue;
      const corner = { x: from.at.x + cross.ta * Math.cos(from.dir * RAD), y: from.at.y + cross.ta * Math.sin(from.dir * RAD) };
      // The bay must sit across this corner, not somewhere else on the floor.
      if (gap(corner, middle) > f.width + f.depth) continue;
      if (!best || gap(corner, middle) < gap(best.corner, middle)) best = { a, b, ...cross, turn: Math.sign(turn) * 90, corner };
    }
  }
  if (!best) return null;

  // Turning toward the front (an inside corner), the middle bends back into it: the back edge is the outer one.
  const sign = best.turn > 0 ? -1 : 1;
  const tangent = Math.max(0, Math.min(best.ta, best.tb));
  const centre = tangent - (sign * -f.depth) / 2;
  if (centre - f.depth / 2 < MIN_CURVE_RADIUS) return { refusal: "Too tight for this bay's depth. Move the bays apart or use a shallower bay." };
  const width = Math.floor((centre * Math.PI) / 2 / HALF_FOOT) * HALF_FOOT;
  if (width <= 0) return { refusal: "Too tight for this bay's depth. Move the bays apart or use a shallower bay." };
  const curve = curveFor(width, sign * 45);

  // Meet the nearer bay exactly, carrying straight on from its end.
  const nearA = best.ta <= best.tb;
  const shaped = { ...f, width, curve };
  const local = bayEnds({ ...shaped, x: 0, y: 0, rotation: 0 });
  const join = nearA ? bayEnds(best.a).right : bayEnds(best.b).left;
  const end = nearA ? local.left : local.right;
  const rotation = normalizeAngle(join.dir - end.dir);
  const offset = rotate(end.at, rotation);
  const changes: FitChanges = { x: Math.round(join.at.x - offset.x), y: Math.round(join.at.y - offset.y), rotation, width, curve };
  const placed = bayEnds({ ...f, ...changes });
  const far = nearA ? gap(placed.right.at, bayEnds(best.b).left.at) : gap(placed.left.at, bayEnds(best.a).right.at);
  return { changes, meets: [best.a.id, best.b.id], gap: Math.round(far) };
}
