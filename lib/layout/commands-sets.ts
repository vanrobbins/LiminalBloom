// Table sets and duplication: the commands that create several linked
// items at once. Split from commands.ts to keep both files readable.

import { baseName, nextName, type NewId } from "./factories";
import { gridForSurface, lowerTableLength } from "./fixtures";
import { translate } from "./geometry";
import { DEFAULT_LOWER_DEPTH } from "./limits";
import type { Face, Fixture, Layout, Point, Side, Zone } from "./types";

export function attachLowerTable(layout: Layout, upperId: string, side: Side, newId: NewId): Layout {
  const upper = layout.fixtures.find((f) => f.id === upperId);
  if (!upper || upper.type !== "table" || upper.tableSetId !== null) return layout;

  const existingSet = layout.tableSets.find((s) => s.upperFixtureId === upper.id);
  if (existingSet && layout.fixtures.some((f) => f.tableSetId === existingSet.id && f.setSide === side)) {
    return layout;
  }
  const set = existingSet ?? { id: newId(), upperFixtureId: upper.id, version: 0 };
  const lowerId = newId();
  const width = lowerTableLength(upper, side);
  const lower: Fixture = {
    id: lowerId,
    zoneId: upper.zoneId,
    type: "table",
    name: "",
    x: upper.x,
    y: upper.y,
    width,
    depth: DEFAULT_LOWER_DEPTH,
    rotation: upper.rotation,
    tableSetId: set.id,
    setSide: side,
    version: 0,
  };
  const top: Face = { id: newId(), fixtureId: lowerId, side: "top", ...gridForSurface(width, DEFAULT_LOWER_DEPTH), version: 0 };
  return {
    ...layout,
    tableSets: existingSet ? layout.tableSets : [...layout.tableSets, set],
    fixtures: [...layout.fixtures, lower],
    faces: [...layout.faces, top],
  };
}

export function duplicate(layout: Layout, ids: string[], offset: Point, newId: NewId): Layout {
  const wanted = new Set(ids);
  let next = layout;

  for (const zone of layout.zones.filter((z) => wanted.has(z.id))) {
    const copy: Zone = {
      ...zone,
      id: newId(),
      name: nextName(next.zones.map((z) => z.name), baseName(zone.name)),
      points: translate(zone.points, offset),
      version: 0,
    };
    next = { ...next, zones: [...next.zones, copy] };
  }

  for (const f of layout.fixtures.filter((x) => wanted.has(x.id) && x.tableSetId === null)) {
    const copyId = newId();
    const copy: Fixture = {
      ...f,
      id: copyId,
      name: nextName(next.fixtures.map((x) => x.name), baseName(f.name)),
      x: f.x + offset.x,
      y: f.y + offset.y,
      version: 0,
    };
    next = { ...next, fixtures: [...next.fixtures, copy], faces: [...next.faces, ...copyFaces(layout, f.id, copyId, newId)] };

    const set = layout.tableSets.find((s) => s.upperFixtureId === f.id);
    if (!set) continue;
    const setId = newId();
    next = { ...next, tableSets: [...next.tableSets, { id: setId, upperFixtureId: copyId, version: 0 }] };
    for (const lower of layout.fixtures.filter((x) => x.tableSetId === set.id)) {
      const lowerId = newId();
      next = {
        ...next,
        fixtures: [...next.fixtures, { ...lower, id: lowerId, tableSetId: setId, version: 0 }],
        faces: [...next.faces, ...copyFaces(layout, lower.id, lowerId, newId)],
      };
    }
  }
  return next;
}

function copyFaces(layout: Layout, fromId: string, toId: string, newId: NewId): Face[] {
  return layout.faces
    .filter((face) => face.fixtureId === fromId)
    .map((face) => ({ ...face, id: newId(), fixtureId: toId, version: 0 }));
}
