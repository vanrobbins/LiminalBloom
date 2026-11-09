// Where a zone's name goes and how big (UX audit U5): in the zone's top-left
// corner rather than its middle, where fixtures and their names sit; smaller
// to fit, down to a floor, then cut with "…". Never past the zone's edge.

import { bounds, edgesOf } from "./geometry";
import type { Point } from "./types";

/** On-screen pixels. */
const FONT = 13;
const MIN_FONT = 10;
const PAD = 6;
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

export function zoneLabel(points: Point[], name: string, scale: number): ZoneLabel | null {
  if (points.length < 3 || name.length === 0) return null;
  const box = bounds(points);
  const pad = PAD / scale;
  const y = box.minY + pad + FONT / scale / 2;
  const span = spanAt(points, y);
  if (!span) return null;
  const room = (span[1] - span[0] - 2 * pad) * scale; // in screen pixels
  if (room <= MIN_FONT) return null;
  const fits = (font: number, text: string) => text.length * CHAR * font <= room;
  const font = Math.max(MIN_FONT, Math.min(FONT, room / (name.length * CHAR)));
  let text = name;
  if (!fits(font, text)) {
    const keep = Math.max(1, Math.floor(room / (CHAR * font)) - 1);
    text = `${name.slice(0, keep).trimEnd()}…`;
  }
  return { x: span[0] + pad, y: box.minY + pad + font / scale / 2, fontSize: font / scale, text };
}
