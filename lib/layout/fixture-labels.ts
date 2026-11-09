// Which fixtures the map names (DECISIONS 11-09). A name needs room on its
// fixture, and never covers another name: zone names first, then fixtures from
// the biggest down, so a crowded spot keeps its most prominent name. A set's
// lower tables are named by their upper table and get none of their own. The
// full list beside the map names everything.

import { middleOffset } from "./curves";
import type { Fixture, Layout } from "./types";
import { CHAR, zoneLabel } from "./zone-label";

/** On-screen pixels, as FixtureShape draws them. */
export const FIXTURE_FONT = 12;
const MIN_WIDTH = 56;
const MIN_DEPTH = 18;
const GAP = 2;

type Box = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function nameBox(f: Fixture, scale: number): Box {
  // Drawn at the fixture's middle, upright whatever its rotation.
  const turn = (f.rotation * Math.PI) / 180;
  const along = middleOffset(f);
  const x = f.x - along * Math.sin(turn);
  const y = f.y + along * Math.cos(turn);
  const half = (f.name.length * CHAR * FIXTURE_FONT) / scale / 2 + GAP / scale;
  const tall = FIXTURE_FONT / scale / 2 + GAP / scale;
  return { left: x - half, right: x + half, top: y - tall, bottom: y + tall };
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
    .filter((f) => f.setSide === null && f.width * scale > MIN_WIDTH && f.depth * scale > MIN_DEPTH)
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
