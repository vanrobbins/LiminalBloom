// Wall bays meeting end to end without being a run (DECISIONS 11-11). A bay
// dragged near another bay's end lands on it, turned to carry straight on or
// to make a square corner; a bay already sitting on a neighbour's end keeps
// that end where it is while it bends. Nothing here links: runs are only made
// explicitly (DECISIONS 11-09).

import { fixturesOverlap } from "./curves";
import { normalizeAngle, rotate } from "./frames";
import { SNAP_PX } from "./limits";
import { movingChain } from "./run-join";
import { endsOf, linkPoint, localEnds } from "./runs";
import type { Fixture, Layout, Point } from "./types";

export type BayEnd = "left" | "right";
type Pose = Pick<Fixture, "x" | "y" | "rotation">;

/** A dragged end snaps from this far, in inches; farther when zoomed out (18 px on screen). */
export const END_REACH = 12;
const END_REACH_PX = 1.5 * SNAP_PX;
/** Ends this close are sitting on each other: a snapped bay can stand an inch or two off. */
const TOUCH = 3;
const TURNS = [0, 90, -90];

const other = (end: BayEnd): BayEnd => (end === "left" ? "right" : "left");
const asItem = (f: Fixture) => ({ ...f, runIndex: f.runIndex ?? 0 });
const gap = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
/** a − b, in [−180, 180). */
export const angleDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;
const nearestTurn = (turn: number) => TURNS.reduce((best, t) => (Math.abs(angleDiff(turn, t)) < Math.abs(angleDiff(turn, best)) ? t : best));

/** The whole-degree pose that puts one end of a bay at `at`, travelling `dir` there. */
export function placeEnd(f: Fixture, end: BayEnd, at: Point, dir: number): Pose {
  const local = localEnds(f)[end];
  const rotation = normalizeAngle(dir - local.turn);
  const offset = rotate(local.at, rotation);
  return { x: Math.round(at.x - offset.x), y: Math.round(at.y - offset.y), rotation };
}

/**
 * Whole inches and whole degrees can leave two bays that meet end to end a
 * sliver inside each other, which the map refuses. Step back along `away`, an
 * inch at a time, until they only touch; null when two inches aren't enough.
 */
export function clearOf<T extends Fixture>(placed: T, neighbour: Fixture, away: number): T | null {
  for (let inches = 0; inches <= 2; inches++) {
    const step = rotate({ x: inches, y: 0 }, away);
    const tried = { ...placed, x: placed.x + Math.round(step.x), y: placed.y + Math.round(step.y) };
    if (!fixturesOverlap(tried, neighbour)) return tried;
  }
  return null;
}

/** An end with no run-mate on it. */
function endFree(layout: Layout, f: Fixture, end: BayEnd): boolean {
  if (f.runId === null) return true;
  const last = layout.fixtures.filter((o) => o.runId === f.runId).length - 1;
  return end === "left" ? f.runIndex === 0 : f.runIndex === last;
}

/** Which way a bay runs away from the neighbour its `end` meets. */
const awayFrom = (f: Fixture, end: BayEnd) => (end === "left" ? endsOf(asItem(f)).left.dir : endsOf(asItem(f)).right.dir + 180);

export type EndSnap = {
  /** How far the dragged bays go in all, from where the drag started. */
  delta: Point;
  /** A bay on its own also turns to line up: its id and new rotation. */
  turned: { id: string; rotation: number } | null;
  /** The bay whose end they land on. */
  meets: string;
};

/**
 * A wall bay, or a run of them, dragged by `delta`: when one of its open ends
 * comes near another wall bay's open end, it lands on it. A bay on its own
 * turns to the nearest of straight on or a square corner, so it follows a
 * curved neighbour; a run keeps its turn. Null when no end is near.
 */
export function snapBayEnds(layout: Layout, ids: ReadonlySet<string>, delta: Point, scale: number): EndSnap | null {
  const chain = movingChain(layout, ids);
  if (!chain || chain[0].type !== "wall_bay") return null;
  const d = { x: Math.round(delta.x), y: Math.round(delta.y) };
  const lone = chain.length === 1 && chain[0].runId === null;
  const reach = Math.max(END_REACH, END_REACH_PX / scale);
  let best: EndSnap | null = null;
  let bestGap = Infinity;

  for (const g of layout.fixtures) {
    if (g.type !== "wall_bay" || ids.has(g.id)) continue;
    // `side` is the neighbour's end; the dragged bays meet it with their other end.
    for (const side of ["right", "left"] as const) {
      if (!endFree(layout, g, side)) continue;
      const start = side === "right" ? chain[0] : chain[chain.length - 1];
      const mine = { ...start, x: start.x + d.x, y: start.y + d.y };
      const end = other(side);
      const theirs = endsOf(asItem(g))[side];
      const before = endsOf(asItem(mine))[end];
      let turned = mine;
      if (lone) {
        // The turn from the bay on the left to the one on the right, pulled to straight or a corner.
        const turn = side === "right" ? angleDiff(before.dir, theirs.dir) : angleDiff(theirs.dir, before.dir);
        const off = angleDiff(turn, nearestTurn(turn));
        // Facing the other way: nothing to line up with.
        if (Math.abs(off) > 45) continue;
        turned = { ...mine, rotation: normalizeAngle(mine.rotation + (side === "right" ? -off : off)) };
      }
      const to = linkPoint(asItem(turned), asItem(g), side) ?? theirs.at;
      const far = gap(before.at, to);
      if (far > reach || far >= bestGap) continue;
      const from = endsOf(asItem(turned))[end].at;
      const placed = clearOf({ ...turned, x: Math.round(turned.x + to.x - from.x), y: Math.round(turned.y + to.y - from.y) }, g, awayFrom(turned, end));
      if (!placed) continue;
      bestGap = far;
      best = {
        delta: { x: placed.x - start.x, y: placed.y - start.y },
        turned: placed.rotation === start.rotation ? null : { id: start.id, rotation: placed.rotation },
        meets: g.id,
      };
    }
  }
  return best;
}

export type Anchor = { end: BayEnd; bay: Fixture; at: Point; dir: number };

/**
 * The end of a bay that sits in line on another wall bay's end, when exactly one does:
 * where that end is and which way it runs. Bays in a run are held by the run,
 * and a bay held at both ends bends about its middle, as a bay on its own does.
 */
export function anchorOf(layout: Layout, f: Fixture): Anchor | null {
  if (f.type !== "wall_bay" || f.runId !== null) return null;
  const found: Anchor[] = [];
  for (const end of ["left", "right"] as const) {
    const side = other(end);
    const mine = endsOf(asItem(f))[end];
    for (const g of layout.fixtures) {
      if (g.id === f.id || g.type !== "wall_bay" || !endFree(layout, g, side)) continue;
      const theirs = endsOf(asItem(g))[side];
      // Only lined up, straight on or square: an end that touches at some other angle is free to bend into line.
      const joint = linkPoint(asItem(f), asItem(g), side);
      if (!joint || gap(mine.at, joint) > TOUCH) continue;
      // Hold the neighbour's exact line, so bending again and again never drifts.
      const turn = end === "left" ? angleDiff(mine.dir, theirs.dir) : angleDiff(theirs.dir, mine.dir);
      found.push({ end, bay: g, at: joint, dir: end === "left" ? theirs.dir + nearestTurn(turn) : theirs.dir - nearestTurn(turn) });
      break;
    }
  }
  return found.length === 1 ? found[0] : null;
}

/** The bay at a new curve with its anchored end kept in place: the other end swings. */
export function bendAbout(f: Fixture, anchor: Anchor, curve: number): Pose & { curve: number } {
  const bent = { ...f, curve };
  const placed = { ...bent, ...placeEnd(bent, anchor.end, anchor.at, anchor.dir) };
  const clear = clearOf(placed, anchor.bay, awayFrom(placed, anchor.end)) ?? placed;
  return { curve, x: clear.x, y: clear.y, rotation: clear.rotation };
}
