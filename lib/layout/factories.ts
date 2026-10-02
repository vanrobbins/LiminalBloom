// Making new items with sensible defaults (spec §5 table, §7 "Adding").
// Pure: ids come from the caller, so tests and undo are repeatable.

import { FIXTURE_RULES } from "./fixtures";
import { DEFAULT_ENTRANCE_WIDTH, MAX_NAME } from "./limits";
import {
  ZONE_COLORS,
  type Entrance,
  type Face,
  type Fixture,
  type FixtureType,
  type Layout,
  type Point,
  type Zone,
  type ZoneColor,
} from "./types";

export type NewId = () => string;

/** A new zone starts as a 10 ft square. */
const NEW_ZONE_SIZE = 120;
/** How far apart the free-spot search steps, in inches. */
const SEARCH_STEP = 24;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "Table" → "Table 4" when "Table 3" is the highest, ignoring case and spacing. */
export function nextName(existing: readonly string[], base: string): string {
  const pattern = new RegExp(`^${escapeRegExp(base.trim().toLowerCase())}\\s+(\\d+)$`);
  let highest = 0;
  for (const name of existing) {
    const match = name.trim().toLowerCase().match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${base} ${highest + 1}`.slice(0, MAX_NAME);
}

/** "Table 12" → "Table", for naming a copy. */
export function baseName(name: string): string {
  return name.replace(/\s+\d+$/, "").trim() || name.trim();
}

export function rectanglePoints(width: number, depth: number, origin: Point = { x: 0, y: 0 }): Point[] {
  return [
    origin,
    { x: origin.x + width, y: origin.y },
    { x: origin.x + width, y: origin.y + depth },
    { x: origin.x, y: origin.y + depth },
  ];
}

export function leastUsedColor(zones: readonly Zone[]): ZoneColor {
  const counts = new Map<ZoneColor, number>(ZONE_COLORS.map((color) => [color, 0]));
  for (const zone of zones) counts.set(zone.color, (counts.get(zone.color) ?? 0) + 1);
  return [...ZONE_COLORS].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0];
}

export function newZone(layout: Layout, id: string, centre: Point): Zone {
  const half = NEW_ZONE_SIZE / 2;
  return {
    id,
    name: nextName(layout.zones.map((z) => z.name), "Zone"),
    type: "display",
    color: leastUsedColor(layout.zones),
    points: rectanglePoints(NEW_ZONE_SIZE, NEW_ZONE_SIZE, {
      x: Math.round(centre.x) - half,
      y: Math.round(centre.y) - half,
    }),
    version: 0,
  };
}

export function newFixture(
  layout: Layout,
  type: FixtureType,
  id: string,
  centre: Point,
  newId: NewId,
): { fixture: Fixture; faces: Face[] } {
  const rule = FIXTURE_RULES[type];
  const fixture: Fixture = {
    id,
    zoneId: null,
    type,
    name: nextName(layout.fixtures.map((f) => f.name), rule.label),
    x: Math.round(centre.x),
    y: Math.round(centre.y),
    width: rule.width,
    depth: rule.depth,
    rotation: 0,
    tableSetId: null,
    setSide: null,
    version: 0,
  };
  const faces = rule.defaultFaces.map((face) => ({
    id: newId(),
    fixtureId: id,
    side: face.side,
    columns: face.columns,
    rows: face.rows,
    version: 0,
  }));
  return { fixture, faces };
}

export function newEntrance(id: string, at: Point): Entrance {
  return { id, x: Math.round(at.x), y: Math.round(at.y), width: DEFAULT_ENTRANCE_WIDTH, version: 0 };
}

/** The nearest spot to `centre`, searching outward in rings, where `fits` says yes. */
export function findFreeSpot(centre: Point, maxRadius: number, fits: (p: Point) => boolean): Point | null {
  const start = { x: Math.round(centre.x), y: Math.round(centre.y) };
  if (fits(start)) return start;
  for (let radius = SEARCH_STEP; radius <= maxRadius; radius += SEARCH_STEP) {
    const steps = Math.max(8, Math.round((2 * Math.PI * radius) / SEARCH_STEP));
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const p = {
        x: Math.round(start.x + radius * Math.cos(angle)),
        y: Math.round(start.y + radius * Math.sin(angle)),
      };
      if (fits(p)) return p;
    }
  }
  return null;
}
