// Which fixtures the map names (DECISIONS 11-09). A name runs through the
// fixture's middle along its longest edge, never upside down; it needs room on its
// fixture, and never covers another name: zone names first, then fixtures from
// the biggest down, so a crowded spot keeps its most prominent name. A set's
// lower tables are named by their upper table and get none of their own. The
// full list beside the map names everything.

import { middleOffset } from "./curves";
import type { Fixture, Layout } from "./types";
import { CHAR, zoneLabel } from "./zone-label";

/** On-screen pixels, as FixtureShape draws them. */
export const FIXTURE_FONT = 12;
const MIN_DEPTH = 18;
const GAP = 2;
/** Room left at each end of the name, on screen. */
const PAD = 4;

type Box = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The name's angle on the map, in degrees: along the fixture's longer side
 * (its width on a tie), turned half a circle if it would read upside down.
 * Upright names read left to right; names on end read bottom to top.
 */
export function labelAngle(f: Pick<Fixture, "rotation" | "width" | "depth">): number {
  const angle = (((f.rotation + (f.depth > f.width ? 90 : 0)) % 360) + 360) % 360;
  return angle >= 90 && angle < 270 ? angle - 180 : angle >= 270 ? angle - 360 : angle;
}

/** The name's length in inches at this scale. */
const nameLength = (f: Fixture, scale: number) => (f.name.length * CHAR * FIXTURE_FONT) / scale;

/** The whole name fits along the longest edge, and the shorter side is tall enough for it. */
function fits(f: Fixture, scale: number): boolean {
  const long = Math.max(f.width, f.depth) * scale;
  const short = Math.min(f.width, f.depth) * scale;
  return short > MIN_DEPTH && nameLength(f, scale) * scale + 2 * PAD <= long;
}

function nameBox(f: Fixture, scale: number): Box {
  // Drawn at the fixture's middle at labelAngle; the box holds it upright.
  const turn = (f.rotation * Math.PI) / 180;
  const along = middleOffset(f);
  const x = f.x - along * Math.sin(turn);
  const y = f.y + along * Math.cos(turn);
  const tilt = (labelAngle(f) * Math.PI) / 180;
  const half = nameLength(f, scale) / 2 + GAP / scale;
  const tall = FIXTURE_FONT / scale / 2 + GAP / scale;
  const w = half * Math.abs(Math.cos(tilt)) + tall * Math.abs(Math.sin(tilt));
  const h = half * Math.abs(Math.sin(tilt)) + tall * Math.abs(Math.cos(tilt));
  return { left: x - w, right: x + w, top: y - h, bottom: y + h };
}

export function shownLabels(layout: Layout, scale: number): Set<string> {
  const taken: Box[] = [];
  for (const zone of layout.zones) {
    const label = zoneLabel(zone.points, zone.name, scale);
    if (!label) continue;
    const half = label.fontSize / 2;
    taken.push({ left: label.x, right: label.x + label.text.length * CHAR * label.fontSize, top: label.y - half, bottom: label.y + half });
  }
  const candidates = layout.fixtures
    .filter((f) => f.setSide === null && fits(f, scale))
    .sort((a, b) => b.width * b.depth - a.width * a.depth);
  const shown = new Set<string>();
  for (const f of candidates) {
    const box = nameBox(f, scale);
    if (taken.some((other) => overlaps(box, other))) continue;
    taken.push(box);
    shown.add(f.id);
  }
  return shown;
}
