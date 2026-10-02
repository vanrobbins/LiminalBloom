// What a drag means, from where it started (spec §6). Every frame turns the
// pointer's total travel into one command applied to the drag's starting
// layout, so nothing is ever added to the previous frame.

import type { Session, Drag } from "./session-core";
import { pointsOf, type Command } from "./commands";
import { dragEntranceEnd } from "./entrances";
import { corners, resizeFromHandle, resizeLowerTable } from "./fixtures";
import { angleTowards } from "./frames";
import { snapAngle, snapDelta, snapPoint, targetsFor, type Guide } from "./snap";
import { OUTLINE_ID, type Layout, type Point } from "./types";

/** Lower tables stand in for their whole set: the ids the move really acts on. */
function directIds(layout: Layout, ids: readonly string[]): Set<string> {
  const direct = new Set(ids);
  const upperOf = new Map(layout.tableSets.map((s) => [s.id, s.upperFixtureId]));
  for (const f of layout.fixtures) {
    if (direct.has(f.id) && f.tableSetId) {
      const upper = upperOf.get(f.tableSetId);
      if (upper) direct.add(upper);
    }
  }
  const sets = new Set(layout.tableSets.filter((s) => direct.has(s.upperFixtureId)).map((s) => s.id));
  for (const f of layout.fixtures) if (f.tableSetId && sets.has(f.tableSetId)) direct.add(f.id);
  return direct;
}

/** Everything that moves: the items, whole table sets, and the fixtures a moved zone carries. */
export function movedIds(layout: Layout, ids: readonly string[]): Set<string> {
  const moved = directIds(layout, ids);
  for (const f of layout.fixtures) if (f.zoneId !== null && moved.has(f.zoneId)) moved.add(f.id);
  return moved;
}

/** The points snapping lines up: a moved zone's corners, a moved fixture's corners, an entrance's centre. */
export function movingPoints(layout: Layout, ids: readonly string[]): Point[] {
  const direct = directIds(layout, ids);
  return [
    ...layout.zones.filter((z) => direct.has(z.id)).flatMap((z) => z.points),
    ...layout.fixtures.filter((f) => direct.has(f.id)).flatMap((f) => corners(f)),
    ...layout.entrances.filter((e) => direct.has(e.id)).map((e) => ({ x: e.x, y: e.y })),
  ];
}

export function planDrag(session: Session, drag: Drag, pointer: Point): { command: Command; guides: Guide[] } | null {
  const { start, target } = drag;
  const { scale } = session.camera;

  if (target.kind === "fixture" || target.kind === "zone" || target.kind === "entrance") {
    const raw = { x: pointer.x - drag.origin.x, y: pointer.y - drag.origin.y };
    const targets = targetsFor(start, movedIds(start, drag.ids));
    const { delta, guides } = snapDelta(movingPoints(start, drag.ids), raw, targets, scale, session.snapping);
    return { command: { type: "move", ids: drag.ids, delta }, guides };
  }
  if (target.kind !== "handle") return null;

  const ref = target.ref;
  switch (ref.kind) {
    case "vertex":
    case "midpoint": {
      const points = pointsOf(start, ref.owner);
      if (!points) return null;
      const base = targetsFor(start, new Set([ref.owner.kind === "zone" ? ref.owner.id : OUTLINE_ID]));
      // The corner's neighbours too, so walls square up (spec §6).
      const before = ref.kind === "vertex" ? points.at(ref.index - 1) : points[ref.index];
      const after = points[(ref.index + 1) % points.length];
      const near = [before, after].filter((p): p is Point => p !== undefined);
      const targets = { xs: [...base.xs, ...near.map((p) => p.x)], ys: [...base.ys, ...near.map((p) => p.y)] };
      const { point, guides } = snapPoint(pointer, targets, scale, session.snapping);
      const command: Command =
        ref.kind === "vertex"
          ? { type: "moveVertex", owner: ref.owner, index: ref.index, to: point }
          : { type: "insertVertex", owner: ref.owner, after: ref.index, at: point };
      return { command, guides };
    }
    case "resize": {
      const f = start.fixtures.find((x) => x.id === ref.fixtureId);
      if (!f) return null;
      const changes = f.tableSetId ? resizeLowerTable(f, ref.side, pointer) : resizeFromHandle(f, ref.side, pointer);
      return { command: { type: "updateFixture", id: f.id, changes }, guides: [] };
    }
    case "rotate": {
      const f = start.fixtures.find((x) => x.id === ref.fixtureId);
      if (!f) return null;
      const rotation = snapAngle(angleTowards(f, pointer), session.snapping);
      return { command: { type: "updateFixture", id: f.id, changes: { rotation } }, guides: [] };
    }
    case "entrance-end": {
      const e = start.entrances.find((x) => x.id === ref.entranceId);
      if (!e || !start.outline) return null;
      const changes = dragEntranceEnd(e, start.outline.points, ref.end, pointer);
      return { command: { type: "updateEntrance", id: e.id, changes }, guides: [] };
    }
  }
}
