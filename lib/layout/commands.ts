// Every edit to a layout, as data (spec §6). `apply` is pure — same layout and
// command, same result — so undo, tests and the server can replay edits
// exactly. Commands never validate: the session and the server decide
// whether to keep what they produce.

import { attachLowerTable, duplicate } from "./commands-sets";
import type { NewId } from "./factories";
import { FIXTURE_RULES, gridForSurface } from "./fixtures";
import { normalizeAngle } from "./frames";
import { translate } from "./geometry";
import { MAX_NAME } from "./limits";
import { normalize } from "./normalize";
import type { Entrance, Face, FaceSide, Fixture, Layout, Point, Side, Zone } from "./types";

export type VertexOwner = { kind: "outline" } | { kind: "zone"; id: string };

export type Command =
  | { type: "setOutline"; points: Point[] }
  | { type: "moveVertex"; owner: VertexOwner; index: number; to: Point }
  | { type: "insertVertex"; owner: VertexOwner; after: number; at: Point }
  | { type: "removeVertex"; owner: VertexOwner; index: number }
  | { type: "addZone"; zone: Zone }
  | { type: "addFixture"; fixture: Fixture; faces: Face[] }
  | { type: "addEntrance"; entrance: Entrance }
  | { type: "move"; ids: string[]; delta: Point }
  | { type: "updateZone"; id: string; changes: Partial<Pick<Zone, "name" | "type" | "color">> }
  | {
      type: "updateFixture";
      id: string;
      changes: Partial<Pick<Fixture, "name" | "x" | "y" | "width" | "depth" | "rotation">>;
    }
  | { type: "updateEntrance"; id: string; changes: Partial<Pick<Entrance, "x" | "y" | "width">> }
  | { type: "setFace"; fixtureId: string; side: FaceSide; on: boolean }
  | { type: "setFaceGrid"; faceId: string; columns: number; rows: number }
  | { type: "attachLowerTable"; upperId: string; side: Side }
  | { type: "duplicate"; ids: string[]; offset: Point }
  | { type: "delete"; ids: string[] };

export function apply(layout: Layout, command: Command, newId: NewId): Layout {
  return normalize(applyRaw(layout, command, newId));
}

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
const cleanName = (name: string) => name.trim().slice(0, MAX_NAME);

export function pointsOf(layout: Layout, owner: VertexOwner): Point[] | null {
  if (owner.kind === "outline") return layout.outline?.points ?? null;
  return layout.zones.find((z) => z.id === owner.id)?.points ?? null;
}

function withPoints(layout: Layout, owner: VertexOwner, points: Point[]): Layout {
  if (owner.kind === "outline") {
    return layout.outline ? { ...layout, outline: { ...layout.outline, points } } : layout;
  }
  return { ...layout, zones: layout.zones.map((z) => (z.id === owner.id ? { ...z, points } : z)) };
}

function applyRaw(layout: Layout, command: Command, newId: NewId): Layout {
  switch (command.type) {
    case "setOutline":
      return { ...layout, outline: { points: command.points.map(round), version: layout.outline?.version ?? 0 } };

    case "moveVertex": {
      const points = pointsOf(layout, command.owner);
      if (!points || !points[command.index]) return layout;
      return withPoints(layout, command.owner, points.map((p, i) => (i === command.index ? round(command.to) : p)));
    }

    case "insertVertex": {
      const points = pointsOf(layout, command.owner);
      if (!points) return layout;
      const next = [...points];
      next.splice(command.after + 1, 0, round(command.at));
      return withPoints(layout, command.owner, next);
    }

    case "removeVertex": {
      const points = pointsOf(layout, command.owner);
      if (!points || points.length <= 3) return layout;
      return withPoints(layout, command.owner, points.filter((_, i) => i !== command.index));
    }

    case "addZone":
      return { ...layout, zones: [...layout.zones, command.zone] };

    case "addFixture":
      return { ...layout, fixtures: [...layout.fixtures, command.fixture], faces: [...layout.faces, ...command.faces] };

    case "addEntrance":
      return { ...layout, entrances: [...layout.entrances, command.entrance] };

    case "move":
      return move(layout, command.ids, round(command.delta));

    case "updateZone":
      return {
        ...layout,
        zones: layout.zones.map((z) =>
          z.id !== command.id
            ? z
            : {
                ...z,
                ...command.changes,
                ...(command.changes.name !== undefined ? { name: cleanName(command.changes.name) } : {}),
              },
        ),
      };

    case "updateFixture":
      return { ...layout, fixtures: layout.fixtures.map((f) => (f.id === command.id ? updateFixture(f, command.changes) : f)) };

    case "updateEntrance":
      return {
        ...layout,
        entrances: layout.entrances.map((e) =>
          e.id !== command.id
            ? e
            : {
                ...e,
                ...(command.changes.x !== undefined ? { x: Math.round(command.changes.x) } : {}),
                ...(command.changes.y !== undefined ? { y: Math.round(command.changes.y) } : {}),
                ...(command.changes.width !== undefined ? { width: Math.round(command.changes.width) } : {}),
              },
        ),
      };

    case "setFace":
      return setFace(layout, command.fixtureId, command.side, command.on, newId);

    case "setFaceGrid":
      return {
        ...layout,
        faces: layout.faces.map((face) =>
          face.id === command.faceId
            ? { ...face, columns: Math.round(command.columns), rows: Math.round(command.rows) }
            : face,
        ),
      };

    case "attachLowerTable":
      return attachLowerTable(layout, command.upperId, command.side, newId);

    case "duplicate":
      return duplicate(layout, command.ids, round(command.offset), newId);

    case "delete": {
      const gone = new Set(command.ids);
      // A deleted zone's fixtures stay; normalize() makes them store-level.
      // Faces, table sets and lower tables are cleaned up by normalize() too.
      return {
        ...layout,
        zones: layout.zones.filter((z) => !gone.has(z.id)),
        fixtures: layout.fixtures.filter((f) => !gone.has(f.id)),
        entrances: layout.entrances.filter((e) => !gone.has(e.id)),
      };
    }
  }
}

function updateFixture(f: Fixture, changes: Partial<Pick<Fixture, "name" | "x" | "y" | "width" | "depth" | "rotation">>): Fixture {
  const isLower = f.tableSetId !== null;
  const next = { ...f };
  if (changes.width !== undefined) next.width = Math.round(changes.width);
  if (changes.depth !== undefined) next.depth = Math.round(changes.depth);
  // A lower table's place, turn and name come from its upper (normalize).
  if (!isLower) {
    if (changes.x !== undefined) next.x = Math.round(changes.x);
    if (changes.y !== undefined) next.y = Math.round(changes.y);
    if (changes.rotation !== undefined) next.rotation = normalizeAngle(changes.rotation);
    if (changes.name !== undefined) next.name = cleanName(changes.name);
  }
  return next;
}

function move(layout: Layout, ids: string[], delta: Point): Layout {
  if (delta.x === 0 && delta.y === 0) return layout;
  const wanted = new Set(ids);
  const upperOf = new Map(layout.tableSets.map((s) => [s.id, s.upperFixtureId]));
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

function setFace(layout: Layout, fixtureId: string, side: FaceSide, on: boolean, newId: NewId): Layout {
  const f = layout.fixtures.find((x) => x.id === fixtureId);
  if (!f) return layout;
  const existing = layout.faces.find((face) => face.fixtureId === fixtureId && face.side === side);
  if (!on) {
    return existing ? { ...layout, faces: layout.faces.filter((face) => face !== existing) } : layout;
  }
  if (existing) return layout;
  const fallback = FIXTURE_RULES[f.type].defaultFaces[0] ?? { columns: 4, rows: 3 };
  const grid = side === "top" ? gridForSurface(f.width, f.depth) : { columns: fallback.columns, rows: fallback.rows };
  return { ...layout, faces: [...layout.faces, { id: newId(), fixtureId, side, ...grid, version: 0 }] };
}
