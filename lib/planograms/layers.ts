// Hung products sharing rail space (DECISIONS 11-09, hung layers spec): any
// hung placement may overlap another hung one on the same face, fully or
// partly. Placements joined through overlaps form a layer group, and each has
// its own depth in it, 0 = front. The server renumbers every group after a
// change (settleDepths), so the order is always 0…n-1 with no gaps or ties.

import type { Presentation } from "@/lib/products/footprint";
import { cellsOverlap } from "@/lib/products/placement";
import type { Cells } from "@/lib/products/location-label";

import type { Change } from "./types";

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

const frontToBack = (a: LayerRow, b: LayerRow) => (a.depth ?? 0) - (b.depth ?? 0) || a.col - b.col || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

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

export type Moved = {
  id: string;
  /** The place asked for in its group (a reorder, an undo); left out, it keeps its own or goes to the back on joining. */
  asked?: number;
  /** Where it was before the change; null for an add. */
  before: LayerRow | null;
};

/**
 * The depth every row should hold. Rows come with the change applied; `moved`
 * is the one that changed. A group keeps its order (merged groups by depth,
 * then left edge); the moved row goes where it asked, else where it was, else
 * to the back when it now shares space with something it didn't before.
 */
export function settleDepths(rows: readonly LayerRow[], moved?: Moved): Map<string, number> {
  const depths = new Map<string, number>();
  for (const group of layerGroups(rows)) {
    const self = moved ? group.find((r) => r.id === moved.id) : undefined;
    const others = self ? group.filter((r) => r !== self) : group;
    const order: LayerRow[] = [...others];
    if (self && moved) {
      const was = moved.before;
      const joined = others.some((o) => sharesSpace(self, o) && !(was && sharesSpace({ ...was, id: self.id }, o)));
      const at = moved.asked ?? (joined ? others.length : (self.depth ?? 0));
      order.splice(Math.max(0, Math.min(others.length, Math.round(at))), 0, self);
    }
    order.forEach((r, i) => depths.set(r.id, Math.min(i, MAX_DEPTH)));
  }
  return depths;
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
 * Move forward / back: the place to ask for, swapping with the nearest product
 * in front or behind that overlaps it; null at that end.
 */
export function reorderTarget(row: LayerRow, rows: readonly LayerRow[], direction: "forward" | "back"): number | null {
  const group = layerGroups(rows).find((g) => g.some((r) => r.id === row.id)) ?? [];
  const at = group.findIndex((r) => r.id === row.id);
  const self = group[at];
  if (!self) return null;
  if (direction === "forward") {
    for (let j = at - 1; j >= 0; j--) if (sharesSpace(self, group[j])) return j;
  } else {
    for (let k = at + 1; k < group.length; k++) if (sharesSpace(self, group[k])) return k;
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

/** What a change leaves: the changed row's depth, and every other row whose depth moves. */
export type Layers = { depth: number; others: [id: string, depth: number][] };

/** The depths a change settles to, for the server to write in the same batch. */
export function layersAfter(rows: readonly (LayerRow & { depth: number })[], change: Change): Layers {
  const id = change.kind === "add" ? "new" : change.id;
  const before = change.kind === "add" ? null : (rows.find((r) => r.id === change.id) ?? null);
  const rest = rows.filter((r) => r.id !== id);
  const moved: Moved | undefined = change.kind === "remove" ? undefined : { id, asked: change.fields.depth, before };
  const next: LayerRow[] = change.kind === "remove" ? rest : [...rest, { ...change.fields, id, depth: before?.depth ?? 0 }];
  const settled = settleDepths(next, moved);
  return {
    depth: settled.get(id) ?? 0,
    others: rest.flatMap((r): [string, number][] => {
      const depth = settled.get(r.id) ?? 0;
      return depth === r.depth ? [] : [[r.id, depth]];
    }),
  };
}
