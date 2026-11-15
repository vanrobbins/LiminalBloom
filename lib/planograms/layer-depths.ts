// Settling hung layers' depths after a change (DECISIONS 11-15, layers.ts). Every row keeps its
// number; only what a change disturbs moves, so trashing a tile and bringing it back, or splitting
// a group and merging it again, puts every layer where it was.

import { frontToBack, layerGroups, MAX_DEPTH, sharesSpace, type LayerRow } from "./layers";
import type { Change, Place } from "./types";

export type Moved = {
  id: string;
  /** The depth asked for (a reorder, or Undo's half past the tile it was behind). A free number it takes; one a tile in its group holds, it takes that tile's place, and the group's numbers are dealt out again in the new order. Left out, it keeps its own, or goes to the back on joining. */
  asked?: number;
  /** Undo's ask (types.ts `Place`), whatever the numbers are now. Beats `asked`. */
  place?: Place;
  /** Where it was before the change; null for an add. */
  before: LayerRow | null;
};

type Placed = { rows: LayerRow[]; order: Map<string, number> };
const faceOf = (rows: readonly LayerRow[], self: LayerRow) => rows.filter((r) => r.faceId === self.faceId && r.presentation === "hung").sort(frontToBack);

/**
 * The mover goes right behind the tile that was before it, but never in front of a tile it was behind or behind one it was
 * in front of, whatever the numbers have become (a tile it never overlapped may have passed one it did). Null when none of
 * those tiles is left to go by.
 */
function placed(rows: readonly LayerRow[], moved: Moved): Placed | null {
  const self = rows.find((r) => r.id === moved.id);
  const { place } = moved;
  if (!self || !place) return null;
  const order = faceOf(rows, self).filter((r) => r !== self);
  const at = (ids: readonly string[]) => ids.map((id) => order.findIndex((r) => r.id === id)).filter((i) => i >= 0);
  const [front, back, prev] = [at(place.front), at(place.back), place.after === null ? [-1] : at([place.after])];
  if (!front.length && !back.length && !prev.length) return null;
  const low = Math.max(-1, ...front) + 1;
  const to = Math.max(low, Math.min(prev.length ? prev[0] + 1 : low, back.length ? Math.min(...back) : order.length));
  // A tile it was in front of that sits ahead of a tile it was behind (numbers of tiles that never overlapped drifted) goes behind it.
  const late = back.filter((i) => i < to);
  const rest = order.filter((_, i) => !late.includes(i));
  rest.splice(to - late.length, 0, self, ...late.sort((a, b) => a - b).map((i) => order[i]));
  const slot = to - late.length;
  return { rows: rows.map((r) => (r === self ? { ...r, depth: slot ? (rest[slot - 1].depth ?? 0) + 1 : 0 } : r)), order: new Map(rest.map((r, i) => [r.id, i])) };
}

/**
 * A face past MAX_DEPTH: each of its hung rows' number becomes its place among the numbers in use on that face (numbers
 * only order tiles within a face, and another face is left alone), so no order changes and groups' ties are kept. With
 * more numbers than the database check holds, each group is ranked by itself instead: ties then only where one group
 * has more than 99 tiles, which no number can order (draftIssues stops publishing a tie).
 */
function tidy(depths: Map<string, number>, rows: readonly LayerRow[]): Map<string, number> {
  const faces = new Map<string, LayerRow[]>();
  for (const r of rows) if (r.presentation === "hung") faces.set(r.faceId, [...(faces.get(r.faceId) ?? []), { ...r, depth: depths.get(r.id) }]);
  const rank = (set: readonly LayerRow[]) => {
    const used = [...new Set(set.map((r) => r.depth))].sort((a, b) => a! - b!);
    for (const r of set) depths.set(r.id, Math.min(used.indexOf(r.depth), MAX_DEPTH));
  };
  for (const face of faces.values()) {
    if (Math.max(...face.map((r) => r.depth ?? 0)) <= MAX_DEPTH) continue;
    if (new Set(face.map((r) => r.depth)).size <= MAX_DEPTH + 1) rank(face);
    else layerGroups(face).forEach(rank);
  }
  return depths;
}

/**
 * A reorder: the mover takes the place of the tile in its group that holds the number it asked for, and the group's
 * numbers are dealt out again in the new order. Other groups on the face keep theirs, so a reorder writes nothing for
 * them (layers.undo.property.test.ts holds exact undo and redo with this). None is made up, none lost, so dealing
 * them back is exact. Null when it isn't a reorder. The new order comes with it: where two tiles of one group are
 * left on one number, it says which is in front.
 */
function reordered(rows: readonly LayerRow[], moved: Moved): Placed | null {
  const self = rows.find((r) => r.id === moved.id);
  const was = moved.before;
  if (!self || moved.asked === undefined || !was) return null;
  const group = layerGroups(rows).find((g) => g.includes(self)) ?? [];
  const others = group.filter((r) => r !== self);
  if (others.some((o) => sharesSpace(self, o) && !sharesSpace({ ...was, id: self.id }, o))) return null;
  const held = others.filter((o) => o.depth === moved.asked);
  if (!held.length) return null;
  const behind = moved.asked > (was.depth ?? 0);
  const occupant = behind ? held[held.length - 1] : held[0];
  const order = others.slice();
  order.splice(order.indexOf(occupant) + (behind ? 1 : 0), 0, self);
  const numbers = group.map((r) => r.depth ?? 0).sort((a, b) => a - b);
  const dealt = new Map(order.map((r, i) => [r.id, numbers[i]]));
  return { rows: rows.map((r) => (dealt.has(r.id) ? { ...r, depth: dealt.get(r.id) } : r)), order: new Map(order.map((r, i) => [r.id, i])) };
}

/**
 * The depth every row should hold. Rows come with the change applied; `moved` is the one that changed. Every row keeps
 * its number; the moved row takes the one it asked for, else keeps its own, else goes to the back when it now shares
 * space with something it didn't before. Ties (a merge's) go by left edge, and a row tied with one in front moves back.
 */
export function settleDepths(rows: readonly LayerRow[], moved?: Moved): Map<string, number> {
  const dealt = moved ? (placed(rows, moved) ?? reordered(rows, moved)) : null;
  const depths = new Map<string, number>();
  for (const group of layerGroups(dealt?.rows ?? rows)) {
    if (dealt) group.sort((a, b) => (dealt.order.get(a.id) ?? 0) - (dealt.order.get(b.id) ?? 0));
    const self = moved && !dealt ? group.find((r) => r.id === moved.id) : undefined;
    const order: LayerRow[] = group.filter((r) => r !== self);
    if (self && moved) {
      const was = moved.before;
      const joined = order.some((o) => sharesSpace(self, o) && !(was && sharesSpace({ ...was, id: self.id }, o)));
      const want = Math.max(0, moved.asked ?? (joined ? (order.at(-1)?.depth ?? 0) + 1 : (self.depth ?? 0)));
      order.splice(order.filter((o) => (o.depth ?? 0) < want).length, 0, { ...self, depth: want });
    }
    let last = -1;
    for (const r of order) depths.set(r.id, (last = Math.max(Math.ceil(r.depth ?? 0), last + 1)));
  }
  return tidy(depths, dealt?.rows ?? rows);
}

/** What a change leaves: the changed row's depth, and every other row whose depth moves. */
export type Layers = { depth: number; others: [id: string, depth: number][] };

/** The depths a change settles to, for the server to write in the same batch. */
export function layersAfter(rows: readonly (LayerRow & { depth: number })[], change: Change): Layers {
  const id = change.kind === "add" ? "new" : change.id;
  const before = change.kind === "add" ? null : (rows.find((r) => r.id === change.id) ?? null);
  const rest = rows.filter((r) => r.id !== id);
  const moved: Moved | undefined = change.kind === "remove" ? undefined : { id, asked: change.fields.depth, place: change.fields.place, before };
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
