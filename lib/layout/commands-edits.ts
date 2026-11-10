// The bigger edits behind `apply` in commands.ts: fixture changes, moves and faces.

import type { NewId } from "./factories";
import { autoGrid, isAutoGrid } from "./fixture-grids";
import { normalizeAngle } from "./frames";
import { translate } from "./geometry";
import { MAX_NAME } from "./limits";
import type { Face, FaceSide, Fixture, Layout, Point } from "./types";

export type FixtureChanges = Partial<Pick<Fixture, "name" | "x" | "y" | "width" | "depth" | "rotation" | "curve">>;

export const cleanName = (name: string) => name.trim().slice(0, MAX_NAME);

export function updateFixture(f: Fixture, changes: FixtureChanges): Fixture {
  const isLower = f.tableSetId !== null;
  const next = { ...f };
  if (changes.width !== undefined) next.width = Math.round(changes.width);
  if (changes.depth !== undefined) next.depth = Math.round(changes.depth);
  if (changes.curve !== undefined) next.curve = Math.round(changes.curve);
  // A lower table's place, turn and name come from its upper (normalize).
  if (!isLower) {
    if (changes.x !== undefined) next.x = Math.round(changes.x);
    if (changes.y !== undefined) next.y = Math.round(changes.y);
    if (changes.rotation !== undefined) next.rotation = normalizeAngle(changes.rotation);
    if (changes.name !== undefined) next.name = cleanName(changes.name);
  }
  return next;
}

export function followSize(face: Face, before: Fixture, after: Fixture): Face {
  if (face.fixtureId !== after.id || !isAutoGrid(before, face)) return face;
  const next = autoGrid(after, face.side);
  return next.columns === face.columns && next.rows === face.rows ? face : { ...face, ...next };
}

export function move(layout: Layout, ids: string[], delta: Point): Layout {
  if (delta.x === 0 && delta.y === 0) return layout;
  const wanted = new Set(ids);
  const upperOf = new Map(layout.tableSets.map((s) => [s.id, s.upperFixtureId]));
  // A rack moves with its whole run (frame racks spec §4.3).
  const runs = new Set(layout.fixtures.filter((f) => wanted.has(f.id) && f.runId !== null).map((f) => f.runId));
  for (const f of layout.fixtures) if (f.runId !== null && runs.has(f.runId)) wanted.add(f.id);
  // A lower table moves with its set: move its upper instead.
  for (const f of layout.fixtures) {
    if (wanted.has(f.id) && f.tableSetId !== null) {
      wanted.delete(f.id);
      const upper = upperOf.get(f.tableSetId);
      if (upper) wanted.add(upper);
    }
  }
  const movedZones = new Set(layout.zones.filter((z) => wanted.has(z.id)).map((z) => z.id));
  return {
    ...layout,
    zones: layout.zones.map((z) => (movedZones.has(z.id) ? { ...z, points: translate(z.points, delta) } : z)),
    fixtures: layout.fixtures.map((f) => {
      // Moving a zone carries its fixtures (spec §3). Lower tables follow their upper.
      const carried = f.tableSetId === null && f.zoneId !== null && movedZones.has(f.zoneId);
      return (wanted.has(f.id) && f.tableSetId === null) || carried ? { ...f, x: f.x + delta.x, y: f.y + delta.y } : f;
    }),
    entrances: layout.entrances.map((e) => (wanted.has(e.id) ? { ...e, x: e.x + delta.x, y: e.y + delta.y } : e)),
  };
}

export function setFace(layout: Layout, fixtureId: string, side: FaceSide, on: boolean, newId: NewId): Layout {
  const f = layout.fixtures.find((x) => x.id === fixtureId);
  if (!f) return layout;
  const existing = layout.faces.find((face) => face.fixtureId === fixtureId && face.side === side);
  if (!on) {
    return existing ? { ...layout, faces: layout.faces.filter((face) => face !== existing) } : layout;
  }
  if (existing) return layout;
  const grid = autoGrid(f, side);
  return { ...layout, faces: [...layout.faces, { id: newId(), fixtureId, side, ...grid, version: 0 }] };
}
