// Hung products sharing rail space (DECISIONS 11-09, hung layers spec): any
// hung placement may overlap another hung one on the same face, fully or
// partly. Placements joined through overlaps form a layer group, and each has
// its own depth in it, lower = nearer the front. Depths are stable (DECISIONS
// 11-15): a change keeps every number, so a split and a merge put the layers
// back where they were (Undo of a trash). Gaps are fine and the order is what
// counts, so drawing and words use a tile's place in its group (layerRanks).
// settleDepths only breaks the ties a merge leaves, and past 98 (the database
// check) renumbers every row at once, keeping the order (layer-depths.ts).

import type { Presentation } from "@/lib/products/footprint";
import { cellsOverlap } from "@/lib/products/placement";
import type { Cells } from "@/lib/products/location-label";

export type LayerRow = Cells & { id: string; faceId: string; presentation: Presentation; depth?: number };

/** The database's check: `depth between 0 and 98`. */
export const MAX_DEPTH = 98;

/** Each step back draws this far up and right, for at most OFFSET_STEPS steps. */
export const OFFSET_PX = 6;
export const OFFSET_STEPS = 3;

/** Same face, both hung, cells overlapping: the only overlap the rules allow. */
export function sharesSpace(a: LayerRow, b: LayerRow): boolean {
  return a.id !== b.id && a.faceId === b.faceId && a.presentation === "hung" && b.presentation === "hung" && cellsOverlap(a, b);
}

export const frontToBack = (a: LayerRow, b: LayerRow) => (a.depth ?? 0) - (b.depth ?? 0) || a.col - b.col || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Every layer group, each front to back; a placement that shares nothing is a group of one. */
export function layerGroups<T extends LayerRow>(rows: readonly T[]): T[][] {
  const seen = new Set<string>();
  const groups: T[][] = [];
  for (const start of rows) {
    if (seen.has(start.id)) continue;
    seen.add(start.id);
    const group = [start];
    for (let i = 0; i < group.length; i++) {
      for (const other of rows) {
        if (!seen.has(other.id) && sharesSpace(group[i], other)) {
          seen.add(other.id);
          group.push(other);
        }
      }
    }
    groups.push(group.sort(frontToBack));
  }
  return groups;
}

/** Each tile's place in its layer group, 0 = front: what drawing and words use, never the raw depth. */
export function layerRanks(rows: readonly LayerRow[]): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const group of layerGroups(rows)) group.forEach((r, i) => ranks.set(r.id, i));
  return ranks;
}

/** What overlaps this one from in front, nearest first. */
export function inFrontOf<T extends LayerRow>(row: LayerRow, rows: readonly T[]): T[] {
  return rows.filter((o) => sharesSpace(row, o) && (o.depth ?? 0) < (row.depth ?? 0)).sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));
}

/** 1 = front; null when it shares space with nothing. */
export function layerNumber(row: LayerRow, rows: readonly LayerRow[]): number | null {
  return rows.some((o) => sharesSpace(row, o)) ? inFrontOf(row, rows).length + 1 : null;
}

/** How far up and right a tile draws: one step per product in front of it, at most three. */
export function layerOffset(row: LayerRow, rows: readonly LayerRow[]): number {
  return Math.min(inFrontOf(row, rows).length, OFFSET_STEPS) * OFFSET_PX;
}

/**
 * Move forward / back: the depth to ask for, that of the nearest product in
 * front or behind that overlaps it (the mover takes its place); null at that end.
 */
export function reorderTarget(row: LayerRow, rows: readonly LayerRow[], direction: "forward" | "back"): number | null {
  const group = layerGroups(rows).find((g) => g.some((r) => r.id === row.id)) ?? [];
  const at = group.findIndex((r) => r.id === row.id);
  const self = group[at];
  if (!self) return null;
  if (direction === "forward") {
    for (let j = at - 1; j >= 0; j--) if (sharesSpace(self, group[j])) return group[j].depth ?? 0;
  } else {
    for (let k = at + 1; k < group.length; k++) if (sharesSpace(self, group[k])) return group[k].depth ?? 0;
  }
  return null;
}

/** Back to front, so the front one paints last. */
export function paintOrder<T extends LayerRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));
}

/** "front", "2nd from front", …; null when it shares space with nothing. */
export function layerWords(layer: number | null): string | null {
  if (layer === null) return null;
  if (layer === 1) return "front";
  const suffix = layer % 10 === 2 && layer % 100 !== 12 ? "nd" : layer % 10 === 3 && layer % 100 !== 13 ? "rd" : layer % 10 === 1 && layer % 100 !== 11 ? "st" : "th";
  return `${layer}${suffix} from front`;
}

/** "Behind Navy Tee", "Behind Navy Tee and Sand Tee", "Behind Navy Tee and 2 others". */
export function behindWords(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `Behind ${names[0]}`;
  if (names.length === 2) return `Behind ${names[0]} and ${names[1]}`;
  return `Behind ${names[0]} and ${names.length - 1} others`;
}
