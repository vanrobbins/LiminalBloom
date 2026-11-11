// Easier curving (run joins spec §3; DECISIONS 11-11). A bay sitting on a
// neighbour's end bends about that end, so the two stay joined. The curve
// handle snaps to the curves that make a bay's free end run smoothly into a
// nearby wall bay, and lands on it. "Fit to corner" bends a bay into the
// quarter circle between two bays at a corner. None of it links anything:
// runs are only made explicitly (DECISIONS 11-09).

import { anchorOf, bendAbout, clearOf, type Anchor } from "./bay-snap";
import type { FixtureChanges } from "./commands-edits";
import { bendFromHandle, maxCurve } from "./curves";
import { normalizeAngle, rotate } from "./frames";
import { MIN_CURVE_RADIUS, SNAP_PX } from "./limits";
import { endsOf } from "./runs";
import type { Fixture, Layout, Point } from "./types";

/** How close a bent end must come to a neighbour's end to count as meeting it. */
export const MEET_REACH = 12;
/** How far, in inches of curve, the handle is pulled onto a meeting curve; farther when zoomed out (12 px on screen). */
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

export type Meeting = { curve: number; meets: string; changes: FixtureChanges };

/**
 * Every curve that makes one of this bay's ends run straight on into another
 * wall bay's end, within reach, and the pose that lands it there. A bay
 * anchored at one end bends about it, so only its free end can meet another.
 */
export function meetingCurves(layout: Layout, f: Fixture, anchor: Anchor | null = anchorOf(layout, f)): Meeting[] {
  const limit = maxCurve(f.width, f.depth);
  const found: Meeting[] = [];
  for (const g of layout.fixtures) {
    if (g.id === f.id || g.type !== "wall_bay" || g.id === anchor?.bay.id) continue;
    const theirs = bayEnds(g);
    // f's right end into g's left end: f.rotation − half = g's left direction. f's left end from g's right: f.rotation + half.
    // On its own f turns by `half` at each end; anchored, the free end takes the whole turn.
    const tries: [number, "left" | "right", Point][] = !anchor
      ? [
          [angleDiff(f.rotation, theirs.left.dir), "right", theirs.left.at],
          [angleDiff(theirs.right.dir, f.rotation), "left", theirs.right.at],
        ]
      : anchor.end === "left"
        ? [[angleDiff(anchor.dir, theirs.left.dir) / 2, "right", theirs.left.at]]
        : [[angleDiff(theirs.right.dir, anchor.dir) / 2, "left", theirs.right.at]];
    for (const [half, end, at] of tries) {
      if (Math.abs(half) >= 90) continue;
      const curve = curveFor(f.width, half);
      if (curve === 0 || Math.abs(curve) > limit) continue;
      const held = anchor ? bendAbout(f, anchor, curve) : null;
      const bent = { ...f, curve, ...held };
      const from = bayEnds(bent)[end].at;
      if (gap(from, at) > MEET_REACH) continue;
      if (held) {
        found.push({ curve, meets: g.id, changes: held });
        continue;
      }
      // Slide the bay so its end sits on the neighbour's, not just near it.
      const moved = { ...bent, x: Math.round(bent.x + at.x - from.x), y: Math.round(bent.y + at.y - from.y) };
      const placed = clearOf(moved, g, end === "left" ? bayEnds(moved).left.dir : bayEnds(moved).right.dir + 180);
      if (placed) found.push({ curve, meets: g.id, changes: { curve, x: placed.x, y: placed.y } });
    }
  }
  return found;
}

export type Bend = { changes: FixtureChanges; meets: string | null };

/**
 * A bay at `curve`: bent about its anchored end when it has one, and pulled
 * onto a meeting curve within reach. `meets` is the bay it runs into, or the
 * one it stays joined to.
 */
export function snapBend(layout: Layout, f: Fixture, curve: number, snapping: boolean, scale = 1): Bend {
  if (f.type !== "wall_bay") return { changes: { curve }, meets: null };
  const anchor = anchorOf(layout, f);
  const reach = Math.max(BEND_SNAP, SNAP_PX / scale);
  const near = snapping
    ? meetingCurves(layout, f, anchor)
        .filter((m) => Math.abs(m.curve - curve) <= reach)
        .sort((a, b) => Math.abs(a.curve - curve) - Math.abs(b.curve - curve))[0]
    : undefined;
  if (near) return { changes: near.changes, meets: near.meets };
  return anchor ? { changes: bendAbout(f, anchor, curve), meets: anchor.bay.id } : { changes: { curve }, meets: null };
}

/**
 * The curve handle dragged from `origin` to `pointer`. The middle of the bay
 * follows the pointer either way: on its own a bay bends toward the pointer;
 * held at one end it swings toward it, which is the opposite curve.
 */
export function bendWithHandle(layout: Layout, f: Fixture, origin: Point, pointer: Point, snapping: boolean, scale: number): Bend {
  const held = anchorOf(layout, f) !== null;
  const curve = held ? bendFromHandle(f, pointer, origin, snapping) : bendFromHandle(f, origin, pointer, snapping);
  return snapBend(layout, f, curve, snapping, scale);
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
