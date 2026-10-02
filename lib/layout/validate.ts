// Every rule a layout must keep (spec §5), as plain-language issues. The
// editor and the server import this same function (spec §8), so the browser
// and the database can never disagree about what is allowed. Merch Mobile
// saved self-crossing zones because its check lived in one screen only.

import { isOnWall, wallSpan } from "./entrances";
import { FIXTURE_RULES, corners, mayOverlap, rectsOverlap } from "./fixtures";
import { SIDE_LABEL } from "./format";
import { area, bounds, boundsOverlap, distance, edgesOf, polygonContains, polygonsOverlap, selfIntersects } from "./geometry";
import {
  MAX_CORNERS,
  MAX_COORD,
  MAX_ENTRANCE_WIDTH,
  MAX_FIXTURE_SIZE,
  MAX_GRID,
  MAX_NAME,
  MIN_ENTRANCE_WIDTH,
  MIN_FIXTURE_SIZE,
  MIN_OUTLINE_EDGE,
  MIN_ZONE_AREA,
  MIN_ZONE_EDGE,
} from "./limits";
import { OUTLINE_ID, type Issue, type IssueKind, type Layout, type Point } from "./types";

type Wants = (id: string) => boolean;

function issue(itemId: string, kind: IssueKind, message: string, blockerId?: string): Issue {
  return blockerId === undefined ? { itemId, kind, message } : { itemId, kind, message, blockerId };
}

const offMap = (p: Point) => p.x < 0 || p.y < 0 || p.x > MAX_COORD || p.y > MAX_COORD;
const nameKey = (name: string) => name.trim().toLowerCase();
const goodName = (name: string) => name.trim().length >= 1 && name.trim().length <= MAX_NAME;
/** A shape the overlap and containment tests can trust. */
const isSimple = (points: Point[]) =>
  points.length >= 3 && points.length <= MAX_CORNERS && !selfIntersects(points);

export function validate(layout: Layout, only?: ReadonlySet<string>): Issue[] {
  // An outline change can push anything outside, so it checks everything.
  const all = only === undefined || only.has(OUTLINE_ID);
  const wants: Wants = (id) => all || (only?.has(id) ?? false);
  return [
    ...outlineIssues(layout, all),
    ...zoneIssues(layout, wants),
    ...fixtureIssues(layout, wants),
    ...entranceIssues(layout, wants),
  ];
}

/** Issues that block a change: new ones, on an item it changed or caused by one. */
export function newIssues(before: Issue[], after: Issue[], changed: ReadonlySet<string>): Issue[] {
  const key = (i: Issue) => `${i.itemId}|${i.kind}|${i.blockerId ?? ""}`;
  const existing = new Set(before.map(key));
  return after.filter(
    (i) =>
      (changed.has(i.itemId) || (i.blockerId !== undefined && changed.has(i.blockerId))) &&
      !existing.has(key(i)),
  );
}

function outlineIssues(layout: Layout, all: boolean): Issue[] {
  const outline = layout.outline;
  if (!outline) {
    const placed = layout.zones.length + layout.fixtures.length + layout.entrances.length;
    return placed > 0 ? [issue(OUTLINE_ID, "corners", "Set up the store outline first.")] : [];
  }
  if (!all) {
    return [];
  }
  const issues: Issue[] = [];
  const { points } = outline;
  if (points.length < 3 || points.length > MAX_CORNERS) {
    issues.push(issue(OUTLINE_ID, "corners", "The store outline needs 3 to 64 corners."));
  } else if (selfIntersects(points)) {
    issues.push(issue(OUTLINE_ID, "crosses-itself", "The store outline crosses itself."));
  }
  if (edgesOf(points).some(([a, b]) => distance(a, b) < MIN_OUTLINE_EDGE)) {
    issues.push(issue(OUTLINE_ID, "short-edge", "Every wall must be at least 1 ft long."));
  }
  if (points.some(offMap)) {
    issues.push(issue(OUTLINE_ID, "out-of-bounds", "The store outline runs off the map."));
  }
  return issues;
}

/** The outline, if it is sound enough to test containment against. */
function usableOutline(layout: Layout): Point[] | null {
  return layout.outline && isSimple(layout.outline.points) ? layout.outline.points : null;
}

function zoneIssues(layout: Layout, wants: Wants): Issue[] {
  const issues: Issue[] = [];
  const outline = usableOutline(layout);
  const firstByName = new Map<string, string>();

  for (const zone of layout.zones) {
    const first = firstByName.get(nameKey(zone.name));
    if (first === undefined) {
      firstByName.set(nameKey(zone.name), zone.id);
    } else if (wants(zone.id) || wants(first)) {
      issues.push(issue(zone.id, "duplicate-name", `Another zone is already called ${zone.name.trim()}.`, first));
    }
    if (!wants(zone.id)) continue;

    const { points, name } = zone;
    if (!goodName(name)) issues.push(issue(zone.id, "name", "A zone needs a name of 1 to 60 characters."));
    if (points.length < 3 || points.length > MAX_CORNERS) {
      issues.push(issue(zone.id, "corners", `${name} needs 3 to 64 corners.`));
    } else if (selfIntersects(points)) {
      issues.push(issue(zone.id, "crosses-itself", `${name} crosses itself.`));
    }
    if (edgesOf(points).some(([a, b]) => distance(a, b) < MIN_ZONE_EDGE)) {
      issues.push(issue(zone.id, "short-edge", `${name} has an edge shorter than 6 in.`));
    }
    if (area(points) < MIN_ZONE_AREA) issues.push(issue(zone.id, "too-small", `${name} is smaller than 4 sq ft.`));
    if (points.some(offMap)) issues.push(issue(zone.id, "out-of-bounds", `${name} runs off the map.`));
    if (outline && isSimple(points) && !polygonContains(outline, points)) {
      issues.push(issue(zone.id, "outside-store", `${name} is outside the store.`, OUTLINE_ID));
    }
  }

  const zones = layout.zones;
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      if (!wants(a.id) && !wants(b.id)) continue;
      if (!isSimple(a.points) || !isSimple(b.points)) continue;
      if (!boundsOverlap(bounds(a.points), bounds(b.points)) || !polygonsOverlap(a.points, b.points)) continue;
      issues.push(issue(a.id, "overlap", `Overlaps ${b.name}.`, b.id), issue(b.id, "overlap", `Overlaps ${a.name}.`, a.id));
    }
  }
  return issues;
}

function fixtureIssues(layout: Layout, wants: Wants): Issue[] {
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
    if (offMap(f)) issues.push(issue(f.id, "out-of-bounds", `${f.name} runs off the map.`));
    if (outline && !polygonContains(outline, corners(f))) {
      issues.push(issue(f.id, "outside-store", `${f.name} is outside the store.`, OUTLINE_ID));
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
      if ([face.columns, face.rows].some((n) => n < 1 || n > MAX_GRID)) {
        issues.push(issue(f.id, "grid", "Each grid needs 1 to 24 columns and rows."));
      }
    }
    if (rule.faces.length > 0 && faces.length === 0) {
      issues.push(issue(f.id, "faces", `${f.name} needs at least one display side.`));
    }

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
  const boxes = fixtures.map((f) => bounds(corners(f)));
  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      const a = fixtures[i];
      const b = fixtures[j];
      if (!wants(a.id) && !wants(b.id)) continue;
      if (!boundsOverlap(boxes[i], boxes[j]) || !rectsOverlap(a, b) || mayOverlap(a, b, layout.tableSets)) continue;
      issues.push(issue(a.id, "overlap", `Blocked by ${b.name}.`, b.id), issue(b.id, "overlap", `Blocked by ${a.name}.`, a.id));
    }
  }
  return issues;
}

function entranceIssues(layout: Layout, wants: Wants): Issue[] {
  const issues: Issue[] = [];
  const outline = layout.outline?.points ?? null;
  for (const e of layout.entrances) {
    if (!wants(e.id)) continue;
    if (e.width < MIN_ENTRANCE_WIDTH || e.width > MAX_ENTRANCE_WIDTH) {
      issues.push(issue(e.id, "size", "Entrances must be 3 ft to 20 ft wide."));
    }
    if (outline && !isOnWall(e, outline)) {
      issues.push(issue(e.id, "off-wall", "This entrance doesn't fit on a wall.", OUTLINE_ID));
    }
  }
  if (!outline) return issues;

  const spans = layout.entrances.map((e) => wallSpan(e, outline));
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i];
      const b = spans[j];
      const ea = layout.entrances[i];
      const eb = layout.entrances[j];
      if (!a || !b || a.index !== b.index || (!wants(ea.id) && !wants(eb.id))) continue;
      if (Math.min(a.to, b.to) - Math.max(a.from, b.from) > 0.5) {
        issues.push(issue(ea.id, "overlap", "Overlaps another entrance.", eb.id), issue(eb.id, "overlap", "Overlaps another entrance.", ea.id));
      }
    }
  }
  return issues;
}
