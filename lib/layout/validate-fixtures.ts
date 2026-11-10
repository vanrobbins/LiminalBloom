// The rules a fixture and its run must keep (spec §5; frame racks spec §4.4).

import { polygonContains } from "./crossings";
import { fixturesOverlap, footprint, maxCurve } from "./curves";
import { FIXTURE_RULES, mayOverlap } from "./fixtures";
import { SIDE_LABEL, formatLength } from "./format";
import { bounds, boundsOverlap } from "./geometry";
import { MAX_FIXTURE_SIZE, MAX_GRID_COLUMNS, MAX_GRID_ROWS, MIN_FIXTURE_SIZE } from "./limits";
import { MAX_RUN_RACKS, MIN_RUN_RACKS, isRunType, runShape, runWord } from "./runs";
import { OUTLINE_ID, type Fixture, type Issue, type Layout } from "./types";
import { goodName, issue, nameKey, offMap, usableOutline, type Wants } from "./validate-core";

export function fixtureIssues(layout: Layout, wants: Wants): Issue[] {
  const issues: Issue[] = [];
  const outline = usableOutline(layout);
  const firstByName = new Map<string, string>();

  for (const f of layout.fixtures) {
    const first = firstByName.get(nameKey(f.name));
    if (first === undefined) {
      firstByName.set(nameKey(f.name), f.id);
    } else if (wants(f.id) || wants(first)) {
      issues.push(issue(f.id, "duplicate-name", `Another fixture is already called ${f.name.trim()}.`, first));
    }
    if (!wants(f.id)) continue;

    const rule = FIXTURE_RULES[f.type];
    if (!goodName(f.name)) issues.push(issue(f.id, "name", "A fixture needs a name of 1 to 60 characters."));
    if ([f.width, f.depth].some((n) => n < MIN_FIXTURE_SIZE || n > MAX_FIXTURE_SIZE)) {
      issues.push(issue(f.id, "size", `${f.name} must be 1 ft to 50 ft on each side.`));
    }
    if (f.curve !== 0 && !rule.curves) {
      issues.push(issue(f.id, "curve", `A ${rule.label.toLowerCase()} can't curve.`));
    } else if (Math.abs(f.curve) > maxCurve(f.width, f.depth)) {
      issues.push(issue(f.id, "curve", `${f.name} can curve at most ${formatLength(maxCurve(f.width, f.depth))} at this size.`));
    }
    if (offMap(f)) issues.push(issue(f.id, "out-of-bounds", `${f.name} runs off the map.`));
    if (outline && !polygonContains(outline, footprint(f))) {
      const bends = f.curve !== 0 && polygonContains(outline, footprint({ ...f, curve: 0 }));
      const why = bends ? "bends past the wall. Move it forward, or flip the curve." : "is outside the store.";
      issues.push(issue(f.id, "outside-store", `${f.name} ${why}`, OUTLINE_ID));
    }

    const faces = layout.faces.filter((face) => face.fixtureId === f.id);
    const sides = new Set<string>();
    for (const face of faces) {
      if (!rule.faces.includes(face.side)) {
        issues.push(issue(f.id, "faces", `${f.name} cannot display on its ${SIDE_LABEL[face.side].toLowerCase()}.`));
      }
      if (sides.has(face.side)) {
        issues.push(issue(f.id, "faces", `${f.name} has two ${SIDE_LABEL[face.side].toLowerCase()} grids.`));
      }
      sides.add(face.side);
      if (face.columns < 1 || face.columns > MAX_GRID_COLUMNS || face.rows < 1 || face.rows > MAX_GRID_ROWS) {
        issues.push(issue(f.id, "grid", "Each grid needs ½ to 24 ft of width and 1 to 24 rows."));
      }
    }
    if (rule.faces.length > 0 && faces.length === 0) {
      issues.push(issue(f.id, "faces", `${f.name} needs at least one display side.`));
    }
    // A frame rack's one face is its rail: one row (frame racks spec §2).
    if (f.type === "frame_rack" && faces.some((face) => face.rows !== 1)) {
      issues.push(issue(f.id, "grid", `${f.name} has one rail, so one row.`));
    }
    issues.push(...runIssues(layout, f));

    if (f.tableSetId !== null) {
      const set = layout.tableSets.find((s) => s.id === f.tableSetId);
      const upper = set ? layout.fixtures.find((u) => u.id === set.upperFixtureId) : undefined;
      if (!set || !upper || upper.type !== "table" || f.type !== "table" || f.setSide === null) {
        issues.push(issue(f.id, "table-set", "Lower tables attach only to tables."));
      } else {
        // Symmetric, like the overlap checks, so a change to either lower is caught.
        for (const o of layout.fixtures) {
          if (o.id !== f.id && o.tableSetId === f.tableSetId && o.setSide === f.setSide) {
            issues.push(issue(f.id, "table-set", "A table can have only one lower table per side.", o.id));
          }
        }
      }
    }
  }

  const fixtures = layout.fixtures;
  const boxes = fixtures.map((f) => bounds(footprint(f)));
  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      const a = fixtures[i];
      const b = fixtures[j];
      if (!wants(a.id) && !wants(b.id)) continue;
      if (!boundsOverlap(boxes[i], boxes[j]) || !fixturesOverlap(a, b) || mayOverlap(a, b, layout.tableSets)) continue;
      issues.push(issue(a.id, "overlap", `Blocked by ${b.name}.`, b.id), issue(b.id, "overlap", `Blocked by ${a.name}.`, a.id));
    }
  }
  return issues;
}

/**
 * Frame racks spec §4.4, run joins spec §4: 2–6 frame racks or wall bays per
 * run, one type, indexes 0…n−1, joined end to end: racks at 0°, 90° or back to
 * back; bays at 0° or 90°.
 */
function runIssues(layout: Layout, f: Fixture): Issue[] {
  if (f.runId === null && f.runIndex === null) return [];
  const word = runWord(f.type);
  const run = layout.frameRuns.find((r) => r.id === f.runId);
  if (!run || f.runIndex === null) return [issue(f.id, "run", `This ${word}'s run is missing.`)];
  if (!isRunType(f.type)) return [issue(f.id, "run", "Only frame racks and wall bays join a run.")];
  const racks = layout.fixtures.filter((o) => o.runId === run.id);
  if (racks.some((o) => o.type !== f.type)) return [issue(f.id, "run", "A run is all frame racks or all wall bays.")];
  if (racks.length < MIN_RUN_RACKS || racks.length > MAX_RUN_RACKS) return [issue(f.id, "run", `A run has ${MIN_RUN_RACKS} to ${MAX_RUN_RACKS} ${word}s.`)];
  const indexes = racks.map((o) => o.runIndex).sort((a, b) => (a ?? 0) - (b ?? 0));
  if (!indexes.every((n, i) => n === i)) return [issue(f.id, "run", `The ${word}s in a run are numbered from the anchor without gaps.`)];
  const shape = runShape(racks.map((o) => ({ ...o, runIndex: o.runIndex ?? 0 })));
  if (shape.joined) return [];
  const how = f.type === "wall_bay" ? "back corner to back corner, straight or at a corner" : "end to end: straight, at a corner, or back to back";
  return [issue(f.id, "run", `${word === "bay" ? "Bays" : "Racks"} in a run must meet ${how}.`)];
}
