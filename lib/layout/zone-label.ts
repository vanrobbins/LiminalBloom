// Where a zone's name goes and how big (UX audit U5): in the zone's top-left
// corner rather than its middle, where fixtures and their names sit; smaller
// to fit, down to a floor, then cut with "…". Never past the zone's edge.
// Fixtures draw over zones, so a name covered by one moves down to the first
// clear row; with no clear row it isn't drawn (L1, 11-09).

import { bounds, edgesOf, type Bounds } from "./geometry";
import type { Point } from "./types";

/** On-screen pixels. */
const FONT = 13;
const MIN_FONT = 10;
const PAD = 6;
/** Space kept below a fixture the name moved past. */
const GAP = 2;
/** A name's width per character, as a share of its font size (a fair average for the UI font). */
export const CHAR = 0.56;

export type ZoneLabel = { x: number; y: number; fontSize: number; text: string };

/** The leftmost inside stretch of the zone along the line y, as [left, right]. */
function spanAt(points: Point[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (const [a, b] of edgesOf(points)) {
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((p, q) => p - q);
  return xs.length >= 2 ? [xs[0], xs[1]] : null;
}

/** The name fitted to the zone's row whose top is at `top`: font in screen pixels. */
function fitAt(points: Point[], name: string, scale: number, top: number) {
  const pad = PAD / scale;
  const span = spanAt(points, top + FONT / scale / 2);
  if (!span) return null;
  const room = (span[1] - span[0] - 2 * pad) * scale; // in screen pixels
  if (room <= MIN_FONT) return null;
  const font = Math.max(MIN_FONT, Math.min(FONT, room / (name.length * CHAR)));
  let text = name;
  if (text.length * CHAR * font > room) {
    const keep = Math.max(1, Math.floor(room / (CHAR * font)) - 1);
    text = `${name.slice(0, keep).trimEnd()}…`;
  }
  return { x: span[0] + pad, font, text };
}

/** Strict: a name may sit right against a fixture's edge. */
const covers = (b: Bounds, left: number, right: number, top: number, bottom: number) =>
  b.minX < right && left < b.maxX && b.minY < bottom && top < b.maxY;

/** `blocked`: what draws over the zone (fixtures' bounds), which the name must stay clear of. */
export function zoneLabel(points: Point[], name: string, scale: number, blocked: Bounds[] = []): ZoneLabel | null {
  if (points.length < 3 || name.length === 0) return null;
  const box = bounds(points);
  const pad = PAD / scale;
  let top = box.minY + pad;
  for (;;) {
    const fit = fitAt(points, name, scale, top);
    if (!fit) return null;
    const tall = fit.font / scale;
    if (top + tall + pad > box.maxY) return null;
    const right = fit.x + fit.text.length * CHAR * tall;
    const under = blocked.filter((b) => covers(b, fit.x, right, top, top + tall));
    if (under.length === 0) return { x: fit.x, y: top + tall / 2, fontSize: tall, text: fit.text };
    top = Math.max(...under.map((b) => b.maxY)) + GAP / scale;
  }
}
