// Runs (frame racks spec §4.1, run joins spec): frame racks or wall bays
// joined end to end. Nothing about a run's shape is stored. Corners, straight
// joins, back-to-back joins and whether it closes are read from positions
// here, and only here.
//
// Every item has a left and a right end, and a direction there: the way you
// travel along it, left to right. A frame rack's ends are its rail's ends
// (local ±width/2, 0), facing its rotation. A wall bay's ends are its back
// edge's ends, turned by its curve (curves.ts backEdgeEnds). Item i's right end
// meets item i+1's left end, and the second turns from the first by one of:
// straight 0°, a corner ±90°, or (racks only) back 180°: turned around and
// lying straight behind it, back to back.

import { backEdgeEnds, type EdgeEnd } from "./curves";
import { normalizeAngle, rotate, toWorld } from "./frames";
import type { FixtureType, Point } from "./types";

/** Ends this close (whole inches, after rounding) count as joined. */
export const JOIN_TOLERANCE = 1;
/** A curved bay's ends turn by fractions of a degree and rotations are whole, so a turn counts within this. */
export const TURN_TOLERANCE = 0.5;
export const MAX_RUN_RACKS = 6;
export const MIN_RUN_RACKS = 2;

/** A run item. Depth, curve and type matter only to bays and back joins; a bare item is a straight frame rack. */
export type RunRack = { id: string; x: number; y: number; width: number; rotation: number; runIndex: number; depth?: number; curve?: number; type?: FixtureType };
export type Join = "straight" | "corner" | "back";
export type RunShape = {
  /** Item ids, anchor first. */
  order: string[];
  /** Between item i and i+1; null where they don't meet at an allowed angle. */
  joins: (Join | null)[];
  /** The last item's right end meets the anchor's left end. */
  closed: boolean;
  /** Every join holds. */
  joined: boolean;
};

type Shape = Pick<RunRack, "width" | "depth" | "curve" | "type">;
type End = { at: Point; dir: number };

const isBay = (r: Pick<RunRack, "type">) => r.type === "wall_bay";

export function localEnds(r: Shape): { left: EdgeEnd; right: EdgeEnd } {
  if (isBay(r)) return backEdgeEnds({ width: r.width, depth: r.depth ?? 0, curve: r.curve ?? 0 });
  return { left: { at: { x: -r.width / 2, y: 0 }, turn: 0 }, right: { at: { x: r.width / 2, y: 0 }, turn: 0 } };
}

/** Both ends on the map, with the direction of travel at each. */
export function endsOf(r: Pick<RunRack, "x" | "y" | "rotation"> & Shape): { left: End; right: End } {
  const ends = localEnds(r);
  const world = (e: EdgeEnd): End => ({ at: toWorld(r, e.at), dir: r.rotation + e.turn });
  return { left: world(ends.left), right: world(ends.right) };
}

export function rackEnds(r: Pick<RunRack, "x" | "y" | "rotation"> & Shape): { left: Point; right: Point } {
  const ends = endsOf(r);
  return { left: ends.left.at, right: ends.right.at };
}

/** a − b, in (−180, 180]. */
function angleDiff(a: number, b: number): number {
  const d = ((((a - b) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

const turnsFor = (r: Pick<RunRack, "type">) => (isBay(r) ? [0, 90, -90] : [0, 90, -90, 180]);
const kindOf = (turn: number): Join => (turn === 0 ? "straight" : turn === 180 ? "back" : "corner");
const dirAt = (r: Pick<RunRack, "rotation"> & Shape, side: "left" | "right") => r.rotation + localEnds({ ...r, width: r.width ?? 0 })[side].turn;

/** The allowed turn from a's right end to b's left end, or null (45°, or a bay turned around). */
function turnOf(a: Pick<RunRack, "rotation"> & Shape, b: Pick<RunRack, "rotation"> & Shape): number | null {
  const d = angleDiff(dirAt(b, "left"), dirAt(a, "right"));
  return turnsFor(a).find((t) => Math.abs(angleDiff(d, t)) <= TURN_TOLERANCE) ?? null;
}

/** Straight, corner, back to back (racks), or null for any other turn. */
export function turnBetween(a: Pick<RunRack, "rotation"> & Partial<Shape>, b: Pick<RunRack, "rotation"> & Partial<Shape>): Join | null {
  const turn = turnOf({ width: 0, ...a }, { width: 0, ...b });
  return turn === null ? null : kindOf(turn);
}

export const plus = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: q.y + p.y });

/**
 * Where b's left end sits when it joins a's right end with this turn. Back to
 * back, straight behind a by both half depths. A bay turning in toward its own
 * front (an inside corner) starts at a's front edge, so the two never overlap.
 */
function jointOf(a: RunRack, b: Shape, turn: number): Point {
  const end = endsOf(a).right;
  if (turn === 180) return plus(end.at, rotate({ x: 0, y: -((a.depth ?? 0) + (b.depth ?? 0)) / 2 }, end.dir));
  if (isBay(a) && turn === 90) return plus(end.at, rotate({ x: a.depth ?? 0, y: 0 }, end.dir + turn));
  return end.at;
}

/** Where b's left end goes when b follows a, or null when b's turn from a isn't allowed. */
export function joint(a: RunRack, b: RunRack): Point | null {
  const turn = turnOf(a, b);
  return turn === null ? null : jointOf(a, b, turn);
}

/**
 * Linking `moving` onto `target`'s open `side`: where moving's joining end
 * (its left end for the target's right, its right end for the target's left)
 * must go, or null when their turn isn't allowed. The target stays put.
 */
export function linkPoint(moving: RunRack, target: RunRack, side: "left" | "right"): Point | null {
  if (side === "right") return joint(target, moving);
  const at = joint(moving, target);
  if (!at) return null;
  const right = endsOf(moving).right.at;
  const left = endsOf(target).left.at;
  return { x: left.x - (at.x - right.x), y: left.y - (at.y - right.y) };
}

const meets = (p: Point, q: Point) => Math.abs(Math.round(p.x) - Math.round(q.x)) <= JOIN_TOLERANCE && Math.abs(Math.round(p.y) - Math.round(q.y)) <= JOIN_TOLERANCE;

function joinOf(a: RunRack, b: RunRack): Join | null {
  const turn = turnOf(a, b);
  return turn !== null && meets(endsOf(b).left.at, jointOf(a, b, turn)) ? kindOf(turn) : null;
}

export function byIndex<T extends { runIndex: number }>(racks: readonly T[]): T[] {
  return [...racks].sort((a, b) => a.runIndex - b.runIndex);
}

export function runShape(racks: readonly RunRack[]): RunShape {
  const ordered = byIndex(racks);
  const joins = ordered.slice(0, -1).map((r, i) => joinOf(r, ordered[i + 1]));
  const closed = ordered.length >= 3 && joinOf(ordered[ordered.length - 1], ordered[0]) !== null;
  return { order: ordered.map((r) => r.id), joins, closed, joined: joins.every((j) => j !== null) };
}

/** The allowed turn nearest to the one an item makes now. */
function nearestTurn(a: RunRack, degrees: number): number {
  return turnsFor(a).reduce((best, t) => (Math.abs(angleDiff(degrees, t)) < Math.abs(angleDiff(degrees, best)) ? t : best));
}

/** The whole-degree pose that puts an item's left end at `at`, travelling `dir`. */
export function placeLeftEnd<T extends RunRack>(item: T, at: Point, dir: number): T {
  const rotation = normalizeAngle(dir - localEnds(item).left.turn);
  const offset = rotate(localEnds(item).left.at, rotation);
  return { ...item, rotation, x: Math.round(at.x - offset.x), y: Math.round(at.y - offset.y) };
}

/**
 * Lines the items up from the anchor outward (spec §9: every time, in whole
 * inches, so rounding never drifts): each keeps its turn, rounded to an
 * allowed one, and slides so its left end sits on the joint with the item
 * before. Returns the items that moved, with their new pose.
 */
export function snapRun<T extends RunRack>(racks: readonly T[]): T[] {
  const ordered = byIndex(racks);
  const moved: T[] = [];
  if (ordered.length === 0) return moved;
  let previous: RunRack = ordered[0];
  for (const rack of ordered.slice(1)) {
    const from = endsOf(previous).right.dir;
    const turn = nearestTurn(previous, angleDiff(dirAt(rack, "left"), from));
    // The turn decides the rotation; the rotation decides where the joint is (a back join needs the depth only).
    const turned = placeLeftEnd(rack, { x: 0, y: 0 }, from + turn);
    const placed = placeLeftEnd(rack, jointOf(previous, turned, turn), from + turn);
    if (placed.x !== rack.x || placed.y !== rack.y || placed.rotation !== rack.rotation) moved.push(placed);
    previous = placed;
  }
  return moved;
}

/** Rack ids in reading order: from the anchor, or from `startIndex` when the run is closed (spec §5). */
export function readingOrder(racks: readonly RunRack[], startIndex: number): string[] {
  const shape = runShape(racks);
  if (!shape.closed || startIndex <= 0 || startIndex >= shape.order.length) return shape.order;
  return [...shape.order.slice(startIndex), ...shape.order.slice(0, startIndex)];
}
