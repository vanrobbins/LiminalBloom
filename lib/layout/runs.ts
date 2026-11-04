// Frame rack runs (frame racks spec §4.1): racks joined end to end. Nothing
// about a run's shape is stored. Corners, straight joins and whether it closes
// are read from the racks' positions here, and only here.
//
// A rack's rail runs along its own x axis (frames.ts): its left end is at
// local (−width/2, 0) and its right end at (+width/2, 0). Rack i's right end
// meets rack i+1's left end, and the two turn 0° (straight) or 90° either way
// (a corner) relative to each other.

import { normalizeAngle, rotate, toWorld } from "./frames";
import type { Point } from "./types";

/** Ends this close (whole inches, after rounding) count as joined. */
export const JOIN_TOLERANCE = 1;
export const MAX_RUN_RACKS = 6;
export const MIN_RUN_RACKS = 2;

export type RunRack = { id: string; x: number; y: number; width: number; rotation: number; runIndex: number };
export type Join = "straight" | "corner";
export type RunShape = {
  /** Rack ids, anchor first. */
  order: string[];
  /** Between rack i and i+1; null where they don't meet at an allowed angle. */
  joins: (Join | null)[];
  /** The last rack's right end meets the anchor's left end. */
  closed: boolean;
  /** Every join holds. */
  joined: boolean;
};

export function rackEnds(r: Pick<RunRack, "x" | "y" | "width" | "rotation">): { left: Point; right: Point } {
  return { left: toWorld(r, { x: -r.width / 2, y: 0 }), right: toWorld(r, { x: r.width / 2, y: 0 }) };
}

/** Straight, corner, or null for any other turn (45°, a U-turn). */
export function turnBetween(a: Pick<RunRack, "rotation">, b: Pick<RunRack, "rotation">): Join | null {
  const d = normalizeAngle(b.rotation - a.rotation);
  if (d === 0) return "straight";
  return d === 90 || d === 270 ? "corner" : null;
}

const meets = (p: Point, q: Point) => Math.abs(Math.round(p.x) - Math.round(q.x)) <= JOIN_TOLERANCE && Math.abs(Math.round(p.y) - Math.round(q.y)) <= JOIN_TOLERANCE;

function joinOf(a: RunRack, b: RunRack): Join | null {
  const turn = turnBetween(a, b);
  return turn && meets(rackEnds(a).right, rackEnds(b).left) ? turn : null;
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

/** The allowed turn nearest to a rack's own: 0°, +90° or −90° from the rack before it. */
function nearestTurn(degrees: number): number {
  const d = normalizeAngle(degrees);
  const distance = (t: number) => Math.min(Math.abs(d - normalizeAngle(t)), 360 - Math.abs(d - normalizeAngle(t)));
  return [0, 90, -90].reduce((best, t) => (distance(t) < distance(best) ? t : best));
}

/**
 * Lines the racks up from the anchor outward (spec §9: every time, in whole
 * inches, so rounding never drifts): each rack keeps its turn, rounded to
 * straight or a corner, and slides so its left end sits on the previous
 * rack's right end. Returns the racks that moved, with their new pose.
 */
export function snapRun<T extends RunRack>(racks: readonly T[]): T[] {
  const ordered = byIndex(racks);
  const moved: T[] = [];
  if (ordered.length === 0) return moved;
  let previous: RunRack = ordered[0];
  for (const rack of ordered.slice(1)) {
    const rotation = normalizeAngle(previous.rotation + nearestTurn(rack.rotation - previous.rotation));
    const joint: Point = rackEnds(previous).right;
    const offset = rotate({ x: -rack.width / 2, y: 0 }, rotation);
    const placed: T = { ...rack, rotation, x: Math.round(joint.x - offset.x), y: Math.round(joint.y - offset.y) };
    if (placed.x !== rack.x || placed.y !== rack.y || placed.rotation !== rack.rotation) moved.push(placed);
    previous = placed;
  }
  return moved;
}

/** Where a new straight rack goes at a run's open end (spec §4.3 "Add rack to the left/right"). */
export function poseAtEnd(end: RunRack, side: "left" | "right", width: number): { x: number; y: number; rotation: number } {
  const ends = rackEnds(end);
  const sign = side === "right" ? 1 : -1;
  const joint = side === "right" ? ends.right : ends.left;
  const offset = rotate({ x: (sign * width) / 2, y: 0 }, end.rotation);
  return { x: Math.round(joint.x + offset.x), y: Math.round(joint.y + offset.y), rotation: end.rotation };
}

/** Rack ids in reading order: from the anchor, or from `startIndex` when the run is closed (spec §5). */
export function readingOrder(racks: readonly RunRack[], startIndex: number): string[] {
  const shape = runShape(racks);
  if (!shape.closed || startIndex <= 0 || startIndex >= shape.order.length) return shape.order;
  return [...shape.order.slice(startIndex), ...shape.order.slice(0, startIndex)];
}
