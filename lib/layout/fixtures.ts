// What each kind of fixture is, and the maths of rotated rectangles (spec §5).
// All rotation goes through frames.ts.

import { normalizeAngle, toLocal, toWorld, type Pose } from "./frames";
import { dot, length, subtract } from "./geometry";
import { MAX_FIXTURE_SIZE, MAX_GRID, MIN_FIXTURE_SIZE, ROTATED_EPSILON } from "./limits";
import type { FaceSide, Fixture, FixtureType, Point, Side, TableSet } from "./types";

export type FixtureRule = {
  label: string;
  width: number;
  depth: number;
  /** Sides that may display product; none for mannequins, platforms and props. */
  faces: readonly FaceSide[];
  defaultFaces: readonly { side: FaceSide; columns: number; rows: number }[];
  /** Which edges get resize handles on the map (spec §7). */
  resize: "both" | "width" | "none";
  /** Drawn as a circle; still collides as its square. */
  round: boolean;
};

export const FIXTURE_RULES: Record<FixtureType, FixtureRule> = {
  table: {
    label: "Table",
    width: 72,
    depth: 36,
    faces: ["top"],
    defaultFaces: [{ side: "top", columns: 6, rows: 3 }],
    resize: "both",
    round: false,
  },
  wall_bay: {
    label: "Wall bay",
    width: 48,
    depth: 24,
    faces: ["front"],
    defaultFaces: [{ side: "front", columns: 4, rows: 5 }],
    resize: "width",
    round: false,
  },
  rack: {
    label: "Rack",
    width: 48,
    depth: 24,
    faces: ["front", "back", "left", "right"],
    defaultFaces: [{ side: "front", columns: 4, rows: 3 }],
    resize: "both",
    round: false,
  },
  mannequin: {
    label: "Mannequin",
    width: 24,
    depth: 24,
    faces: [],
    defaultFaces: [],
    resize: "none",
    round: true,
  },
  platform: {
    label: "Platform",
    width: 48,
    depth: 48,
    faces: [],
    defaultFaces: [],
    resize: "both",
    round: false,
  },
  prop: {
    label: "Prop",
    width: 24,
    depth: 24,
    faces: [],
    defaultFaces: [],
    resize: "both",
    round: false,
  },
};

export type Rect = Pose & { width: number; depth: number };

/** Back-left, back-right, front-right, front-left, on the map. */
export function corners(f: Rect): Point[] {
  const w = f.width / 2;
  const d = f.depth / 2;
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ].map((p) => toWorld(f, p));
}

/** Separating-axis test. Touching within ROTATED_EPSILON is not overlapping. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  const ca = corners(a);
  const cb = corners(b);
  const axes = [
    subtract(ca[1], ca[0]),
    subtract(ca[3], ca[0]),
    subtract(cb[1], cb[0]),
    subtract(cb[3], cb[0]),
  ];
  for (const raw of axes) {
    const len = length(raw);
    if (len === 0) continue;
    const axis = { x: raw.x / len, y: raw.y / len };
    const pa = ca.map((p) => dot(p, axis));
    const pb = cb.map((p) => dot(p, axis));
    const overlap =
      Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (overlap <= ROTATED_EPSILON) {
      return false;
    }
  }
  return true;
}

/**
 * Pairs allowed to share floor: a mannequin on a platform, and the tables of
 * one set (lower tables are placed from the upper and rounded to whole
 * inches, so at odd angles they can graze it by a fraction).
 */
export function mayOverlap(a: Fixture, b: Fixture, sets: readonly TableSet[]): boolean {
  const types = new Set([a.type, b.type]);
  if (types.has("mannequin") && types.has("platform")) {
    return true;
  }
  const setOf = (f: Fixture) =>
    f.tableSetId ?? sets.find((s) => s.upperFixtureId === f.id)?.id ?? null;
  const set = setOf(a);
  return set !== null && set === setOf(b);
}

/** A lower table sits centred on its side of the upper, touching it, turned to match. */
export function lowerTablePose(upper: Rect, side: Side, lowerDepth: number): Pose {
  const along = upper.depth / 2 + lowerDepth / 2;
  const across = upper.width / 2 + lowerDepth / 2;
  const local: Record<Side, Point> = {
    front: { x: 0, y: along },
    back: { x: 0, y: -along },
    left: { x: -across, y: 0 },
    right: { x: across, y: 0 },
  };
  const centre = toWorld(upper, local[side]);
  // Side tables turn a quarter so their length runs along the upper's side.
  const turn = side === "left" || side === "right" ? 90 : 0;
  return {
    x: Math.round(centre.x),
    y: Math.round(centre.y),
    rotation: normalizeAngle(upper.rotation + turn),
  };
}

/** A new lower table is as long as the side it sits on. */
export function lowerTableLength(upper: Rect, side: Side): number {
  return side === "front" || side === "back" ? upper.width : upper.depth;
}

/** The lower table's own edge that faces away from the upper table. */
export function outerSide(side: Side): "front" | "back" {
  return side === "front" || side === "left" ? "front" : "back";
}

function clampSize(n: number): number {
  return Math.min(MAX_FIXTURE_SIZE, Math.max(MIN_FIXTURE_SIZE, Math.round(n)));
}

/** Drag the handle on `side` to `pointer`: that edge follows, the opposite edge stays. */
export function resizeFromHandle(
  f: Rect,
  side: Side,
  pointer: Point,
): { x: number; y: number; width: number; depth: number } {
  const local = toLocal(f, pointer);
  let width = f.width;
  let depth = f.depth;
  let cx = 0;
  let cy = 0;
  if (side === "right") {
    width = clampSize(local.x + f.width / 2);
    cx = -f.width / 2 + width / 2;
  } else if (side === "left") {
    width = clampSize(f.width / 2 - local.x);
    cx = f.width / 2 - width / 2;
  } else if (side === "front") {
    depth = clampSize(local.y + f.depth / 2);
    cy = -f.depth / 2 + depth / 2;
  } else {
    depth = clampSize(f.depth / 2 - local.y);
    cy = f.depth / 2 - depth / 2;
  }
  const centre = toWorld(f, { x: cx, y: cy });
  return { x: Math.round(centre.x), y: Math.round(centre.y), width, depth };
}

/** Lower tables stay centred on their side, so both ends move together; normalize() re-places them. */
export function resizeLowerTable(
  f: Rect,
  side: Side,
  pointer: Point,
): { width: number; depth: number } {
  if (side === "left" || side === "right") {
    return { width: clampSize(Math.abs(toLocal(f, pointer).x) * 2), depth: f.depth };
  }
  return { width: f.width, depth: resizeFromHandle(f, side, pointer).depth };
}

/** 0 inside the rectangle, otherwise the gap to its nearest edge. */
export function distanceToRect(f: Rect, p: Point): number {
  const local = toLocal(f, p);
  const dx = Math.max(Math.abs(local.x) - f.width / 2, 0);
  const dy = Math.max(Math.abs(local.y) - f.depth / 2, 0);
  return Math.hypot(dx, dy);
}

/** A cell per foot on a surface seen from above, within the grid limits. */
export function gridForSurface(width: number, depth: number): { columns: number; rows: number } {
  const cells = (inches: number) => Math.min(MAX_GRID, Math.max(1, Math.round(inches / 12)));
  return { columns: cells(width), rows: cells(depth) };
}
