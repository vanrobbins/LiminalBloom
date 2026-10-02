// Everything derived from the geometry, recomputed after every command and
// again on the server (spec §5): a fixture's zone, where lower tables sit,
// entrances on walls, and orphans removed. Derived values are never set
// directly, so they can never drift from the shapes they come from —
// Merch Mobile stored a zone's position and its shape separately, and the two
// disagreed.

import { placeOnWall } from "./entrances";
import { lowerTablePose } from "./fixtures";
import { classify } from "./geometry";
import { MAX_NAME } from "./limits";
import type { Fixture, Layout, Side, TableSet, Zone } from "./types";

const SIDE_NAME: Record<Side, string> = { front: "Front", back: "Back", left: "Left", right: "Right" };

export function lowerTableName(upperName: string, side: Side): string {
  return `${upperName} · ${SIDE_NAME[side]}`.slice(0, MAX_NAME);
}

/** The original array when every element is the same object, so unchanged parts keep their identity. */
function keep<T>(original: T[], next: T[]): T[] {
  return original.length === next.length && original.every((item, i) => item === next[i]) ? original : next;
}

function zoneOf(f: Fixture, zones: Zone[]): string | null {
  const centre = { x: f.x, y: f.y };
  return zones.find((z) => z.points.length >= 3 && classify(centre, z.points) !== "outside")?.id ?? null;
}

export function normalize(layout: Layout): Layout {
  // A set lives only as long as its upper table, and lower tables with their set.
  const fixtureIds = new Set(layout.fixtures.map((f) => f.id));
  let tableSets = layout.tableSets.filter((s) => fixtureIds.has(s.upperFixtureId));
  const liveSets = new Set(tableSets.map((s) => s.id));
  let fixtures = layout.fixtures.filter((f) => f.tableSetId === null || liveSets.has(f.tableSetId));
  // …and a set with no lower tables left is gone too.
  const setsInUse = new Set(fixtures.flatMap((f) => (f.tableSetId === null ? [] : [f.tableSetId])));
  tableSets = tableSets.filter((s) => setsInUse.has(s.id));

  // Zones first for ordinary fixtures; lower tables then copy their upper's.
  fixtures = fixtures.map((f) => {
    if (f.tableSetId !== null) return f;
    const zoneId = zoneOf(f, layout.zones);
    return zoneId === f.zoneId ? f : { ...f, zoneId };
  });
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const upperOf = new Map<string, Fixture>();
  for (const set of tableSets) {
    const upper = byId.get(set.upperFixtureId);
    if (upper) upperOf.set(set.id, upper);
  }
  fixtures = fixtures.map((f) => placeLower(f, upperOf));

  const kept = new Set(fixtures.map((f) => f.id));
  const faces = layout.faces.filter((face) => kept.has(face.fixtureId));
  const outline = layout.outline?.points;
  const entrances = outline && outline.length >= 2 ? layout.entrances.map((e) => placeOnWall(e, outline)) : layout.entrances;

  const next = {
    outline: layout.outline,
    entrances: keep(layout.entrances, entrances),
    zones: layout.zones,
    fixtures: keep(layout.fixtures, fixtures),
    faces: keep(layout.faces, faces),
    tableSets: keep<TableSet>(layout.tableSets, tableSets),
  };
  const unchanged =
    next.entrances === layout.entrances &&
    next.fixtures === layout.fixtures &&
    next.faces === layout.faces &&
    next.tableSets === layout.tableSets;
  return unchanged ? layout : next;
}

function placeLower(f: Fixture, upperOf: Map<string, Fixture>): Fixture {
  if (f.tableSetId === null || f.setSide === null) return f;
  const upper = upperOf.get(f.tableSetId);
  if (!upper) return f;
  const pose = lowerTablePose(upper, f.setSide, f.depth);
  const name = lowerTableName(upper.name, f.setSide);
  const same =
    f.x === pose.x && f.y === pose.y && f.rotation === pose.rotation && f.name === name && f.zoneId === upper.zoneId;
  return same ? f : { ...f, ...pose, name, zoneId: upper.zoneId };
}
