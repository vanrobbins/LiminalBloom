// Everything derived from the geometry, recomputed after every command and
// again on the server (spec §5): a fixture's zone, where lower tables sit,
// entrances on walls, and orphans removed. Derived values are never set
// directly, so they can never drift from the shapes they come from —
// Merch Mobile stored a zone's position and its shape separately, and the two
// disagreed.

import { middleOf } from "./curves";
import { placeOnWall } from "./entrances";
import { lowerTablePose } from "./fixtures";
import { classify } from "./geometry";
import { MAX_NAME } from "./limits";
import { MIN_RUN_RACKS, byIndex, snapRun } from "./runs";
import type { Fixture, FrameRun, Layout, Side, TableSet, Zone } from "./types";

const SIDE_NAME: Record<Side, string> = { front: "Front", back: "Back", left: "Left", right: "Right" };

export function lowerTableName(upperName: string, side: Side): string {
  return `${upperName} · ${SIDE_NAME[side]}`.slice(0, MAX_NAME);
}

/** The original array when every element is the same object, so unchanged parts keep their identity. */
function keep<T>(original: T[], next: T[]): T[] {
  return original.length === next.length && original.every((item, i) => item === next[i]) ? original : next;
}

function zoneOf(f: Fixture, zones: Zone[]): string | null {
  const centre = middleOf(f);
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

  const runs = normalizeRuns(fixtures, layout.frameRuns);
  fixtures = runs.fixtures;

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
    frameRuns: keep<FrameRun>(layout.frameRuns, runs.frameRuns),
  };
  const unchanged =
    next.entrances === layout.entrances &&
    next.fixtures === layout.fixtures &&
    next.faces === layout.faces &&
    next.tableSets === layout.tableSets &&
    next.frameRuns === layout.frameRuns;
  return unchanged ? layout : next;
}

/**
 * Frame rack runs (frame racks spec §4): only frame racks belong, a run lives
 * while it has two racks or more, indexes close up from 0 (the anchor), and
 * every rack after the anchor is snapped onto the end before it. A run left
 * with one rack is gone, and that rack is ordinary again.
 */
function normalizeRuns(fixtures: Fixture[], frameRuns: FrameRun[]): { fixtures: Fixture[]; frameRuns: FrameRun[] } {
  const known = new Set(frameRuns.map((r) => r.id));
  const leave = (f: Fixture): Fixture => (f.runId === null && f.runIndex === null ? f : { ...f, runId: null, runIndex: null });
  let next = fixtures.map((f) => (f.runId === null || !known.has(f.runId) || f.type !== "frame_rack" ? leave(f) : f));

  const members = new Map<string, Fixture[]>();
  for (const f of next) if (f.runId !== null) members.set(f.runId, [...(members.get(f.runId) ?? []), f]);
  const live = frameRuns.filter((r) => (members.get(r.id)?.length ?? 0) >= MIN_RUN_RACKS);
  const liveIds = new Set(live.map((r) => r.id));
  next = next.map((f) => (f.runId !== null && !liveIds.has(f.runId) ? leave(f) : f));

  const changed = new Map<string, Fixture>();
  const runsOut = live.map((run) => {
    const racks = byIndex(members.get(run.id)!.map((f) => ({ ...f, runIndex: f.runIndex ?? Number.MAX_SAFE_INTEGER })));
    const indexed = racks.map((f, i) => ({ ...f, runIndex: i }));
    for (const f of indexed) changed.set(f.id, f);
    for (const f of snapRun(indexed)) changed.set(f.id, f);
    return run.startIndex < racks.length ? run : { ...run, startIndex: 0 };
  });
  next = next.map((f) => {
    const c = changed.get(f.id);
    if (!c) return f;
    const same = c.x === f.x && c.y === f.y && c.rotation === f.rotation && c.runIndex === f.runIndex;
    return same ? f : { ...f, x: c.x, y: c.y, rotation: c.rotation, runIndex: c.runIndex };
  });
  return { fixtures: keep(fixtures, next), frameRuns: keep(frameRuns, runsOut) };
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
