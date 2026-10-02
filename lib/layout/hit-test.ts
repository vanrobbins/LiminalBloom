// What a press lands on (spec §6–7). Handles first, then entrances, fixtures
// (top-most first), zones, and the outline's walls. What can be hit depends on
// the focus level, so a tap is never ambiguous between a zone and the
// fixtures in it. Every fixture test goes through its own frame
// (distanceToRect → toLocal), so rotation can never skew a hit.

import { screenToWorld, worldToScreen, type Camera } from "./camera";
import type { VertexOwner } from "./commands";
import { entranceEnds } from "./entrances";
import { FIXTURE_RULES, distanceToRect, outerSide } from "./fixtures";
import { toWorld } from "./frames";
import { classify, closestPointOnSegment, distance, edgesOf, lerp } from "./geometry";
import { OUTLINE_ID, type Fixture, type Layout, type Point, type Side } from "./types";

export type Focus = { kind: "overview" } | { kind: "zone"; id: string };
export const OVERVIEW: Focus = { kind: "overview" };

export type HandleRef =
  | { kind: "vertex"; owner: VertexOwner; index: number }
  | { kind: "midpoint"; owner: VertexOwner; index: number }
  | { kind: "resize"; fixtureId: string; side: Side }
  | { kind: "rotate"; fixtureId: string }
  | { kind: "entrance-end"; entranceId: string; end: "start" | "end" };

export type HandleSpot = { ref: HandleRef; at: Point };

export type HitTarget =
  | { kind: "empty" }
  | { kind: "marquee" }
  | { kind: "outline" }
  | { kind: "handle"; ref: HandleRef }
  | { kind: "fixture"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "entrance"; id: string };

/** Half of a 44 px target (§1.5), on screen. */
export const HANDLE_RADIUS_PX = 22;
const EDGE_HIT_PX = 8;
const FIXTURE_HIT_PX = 6;
const ROTATE_OFFSET_PX = 32;

export function sameFocus(a: Focus, b: Focus): boolean {
  if (a.kind === "overview" || b.kind === "overview") return a.kind === b.kind;
  return a.id === b.id;
}

/** Store-level fixtures at the overview; a zone's own once it is focused. */
export function isEditableFixture(f: Fixture, focus: Focus): boolean {
  return focus.kind === "overview" ? f.zoneId === null : f.zoneId === focus.id;
}

export function isDraggable(target: HitTarget): boolean {
  return ["handle", "fixture", "zone", "entrance", "marquee"].includes(target.kind);
}

export function handlesFor(layout: Layout, selection: readonly string[], camera: Camera): HandleSpot[] {
  if (selection.length !== 1) return [];
  const [id] = selection;
  if (id === OUTLINE_ID) return layout.outline ? shapeHandles({ kind: "outline" }, layout.outline.points) : [];
  const zone = layout.zones.find((z) => z.id === id);
  if (zone) return shapeHandles({ kind: "zone", id }, zone.points);
  const fixture = layout.fixtures.find((f) => f.id === id);
  if (fixture) return fixtureHandles(fixture, camera);
  const entrance = layout.entrances.find((e) => e.id === id);
  const ends = entrance && layout.outline ? entranceEnds(entrance, layout.outline.points) : null;
  if (!ends) return [];
  return [
    { ref: { kind: "entrance-end", entranceId: id, end: "start" }, at: ends[0] },
    { ref: { kind: "entrance-end", entranceId: id, end: "end" }, at: ends[1] },
  ];
}

function shapeHandles(owner: VertexOwner, points: Point[]): HandleSpot[] {
  return [
    ...points.map((at, index): HandleSpot => ({ ref: { kind: "vertex", owner, index }, at })),
    ...edgesOf(points).map(([a, b], index): HandleSpot => ({
      ref: { kind: "midpoint", owner, index },
      at: lerp(a, b, 0.5),
    })),
  ];
}

function fixtureHandles(f: Fixture, camera: Camera): HandleSpot[] {
  const perPixel = 1 / camera.scale;
  // Small on screen: handles move outside so they do not cover each other (spec §7).
  const out = Math.min(f.width, f.depth) * camera.scale < HANDLE_RADIUS_PX * 2 ? HANDLE_RADIUS_PX * perPixel : 0;
  const rule = FIXTURE_RULES[f.type];
  const sides: Side[] =
    f.tableSetId !== null
      ? [outerSide(f.setSide ?? "front"), "left", "right"]
      : rule.resize === "both"
        ? ["front", "back", "left", "right"]
        : rule.resize === "width"
          ? ["left", "right"]
          : [];
  const offset: Record<Side, Point> = {
    front: { x: 0, y: f.depth / 2 + out },
    back: { x: 0, y: -f.depth / 2 - out },
    left: { x: -f.width / 2 - out, y: 0 },
    right: { x: f.width / 2 + out, y: 0 },
  };
  const spots: HandleSpot[] = sides.map((side) => ({
    ref: { kind: "resize", fixtureId: f.id, side },
    at: toWorld(f, offset[side]),
  }));
  if (f.tableSetId === null) {
    spots.push({
      ref: { kind: "rotate", fixtureId: f.id },
      at: toWorld(f, { x: 0, y: -f.depth / 2 - out - ROTATE_OFFSET_PX * perPixel }),
    });
  }
  return spots;
}

export function hitTest(
  layout: Layout,
  focus: Focus,
  camera: Camera,
  screen: Point,
  handles: readonly HandleSpot[],
  editable: boolean,
): HitTarget {
  const world = screenToWorld(camera, screen);
  const perPixel = 1 / camera.scale;

  if (editable) {
    let best: HandleSpot | null = null;
    let bestDistance = HANDLE_RADIUS_PX;
    for (const handle of handles) {
      const d = distance(worldToScreen(camera, handle.at), screen);
      if (d <= bestDistance) {
        best = handle;
        bestDistance = d;
      }
    }
    if (best) return { kind: "handle", ref: best.ref };

    if (focus.kind === "overview" && layout.outline) {
      for (const e of [...layout.entrances].reverse()) {
        const ends = entranceEnds(e, layout.outline.points);
        if (ends && closestPointOnSegment(world, ends[0], ends[1]).distance <= EDGE_HIT_PX * perPixel) {
          return { kind: "entrance", id: e.id };
        }
      }
    }
  }

  for (const f of [...layout.fixtures].reverse()) {
    if (isEditableFixture(f, focus) && distanceToRect(f, world) <= FIXTURE_HIT_PX * perPixel) {
      return { kind: "fixture", id: f.id };
    }
  }

  if (focus.kind === "overview") {
    for (const z of [...layout.zones].reverse()) {
      if (z.points.length >= 3 && classify(world, z.points) !== "outside") return { kind: "zone", id: z.id };
    }
    if (editable && layout.outline) {
      const nearWall = edgesOf(layout.outline.points).some(
        ([a, b]) => closestPointOnSegment(world, a, b).distance <= EDGE_HIT_PX * perPixel,
      );
      if (nearWall) return { kind: "outline" };
    }
  }
  return { kind: "empty" };
}
