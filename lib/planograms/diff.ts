// What changed between two sets of placements (spec §5.4–5.5), grouped by
// face. A product is matched to itself by face + product + presentation; twins
// that didn't move are paired first.

import type { Presentation } from "@/lib/products/footprint";
import type { Cells } from "@/lib/products/location-label";

import type { PlacementView, PlanogramFace, SnapshotEntry } from "./types";

export type Comparable = Cells & {
  faceId: string;
  faceLabel: string;
  productId: string;
  productName: string;
  presentation: Presentation;
  pieceCount: number;
};
export type Pair = { before: Comparable; after: Comparable };
export type FaceChanges = { faceId: string; label: string; added: Comparable[]; removed: Comparable[]; moved: Pair[]; recounted: Pair[] };

const keyOf = (c: Comparable) => `${c.faceId}|${c.productId}|${c.presentation}`;
const sameCells = (a: Cells, b: Cells) => a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
const byPosition = (a: Cells, b: Cells) => a.row - b.row || a.col - b.col;

export function diffPlacements(before: readonly Comparable[], after: readonly Comparable[]): FaceChanges[] {
  const faces = new Map<string, FaceChanges>();
  const faceOf = (c: Comparable) => {
    let face = faces.get(c.faceId);
    if (!face) {
      face = { faceId: c.faceId, label: c.faceLabel, added: [], removed: [], moved: [], recounted: [] };
      faces.set(c.faceId, face);
    }
    return face;
  };
  for (const c of [...after, ...before]) faceOf(c);

  const groups = new Map<string, { before: Comparable[]; after: Comparable[] }>();
  const group = (c: Comparable) => {
    const key = keyOf(c);
    const found = groups.get(key) ?? { before: [], after: [] };
    groups.set(key, found);
    return found;
  };
  for (const c of before) group(c).before.push(c);
  for (const c of after) group(c).after.push(c);

  for (const g of groups.values()) {
    const left = [...g.before].sort(byPosition);
    const right = [...g.after].sort(byPosition);
    for (const x of [...left]) {
      const i = right.findIndex((y) => sameCells(x, y));
      if (i < 0) continue;
      const [y] = right.splice(i, 1);
      left.splice(left.indexOf(x), 1);
      if (x.pieceCount !== y.pieceCount) faceOf(y).recounted.push({ before: x, after: y });
    }
    left.forEach((x, i) => {
      const y = right[i];
      if (!y) {
        faceOf(x).removed.push(x);
        return;
      }
      faceOf(y).moved.push({ before: x, after: y });
      if (x.pieceCount !== y.pieceCount) faceOf(y).recounted.push({ before: x, after: y });
    });
    right.slice(left.length).forEach((y) => faceOf(y).added.push(y));
  }
  return [...faces.values()].filter((f) => f.added.length + f.removed.length + f.moved.length + f.recounted.length > 0);
}

/** Faces in the planogram's own order; faces not in the list go last (stable). */
export function sortByFaceOrder(changes: readonly FaceChanges[], faceIds: readonly string[]): FaceChanges[] {
  const order = (id: string) => {
    const at = faceIds.indexOf(id);
    return at < 0 ? faceIds.length : at;
  };
  return [...changes].sort((a, b) => order(a.faceId) - order(b.faceId));
}

export function faceSummary(f: FaceChanges): string {
  const parts: [number, string][] = [
    [f.added.length, "added"],
    [f.moved.length, "moved"],
    [f.removed.length, "removed"],
    [f.recounted.length, "count changed"],
  ];
  return `${f.label}: ${parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}`).join(", ")}`;
}

export function summarizeChanges(changes: readonly FaceChanges[]): string {
  return changes.length === 0 ? "No changes" : changes.map(faceSummary).join(" · ");
}

export function comparableDraft(placements: readonly PlacementView[], faces: readonly PlanogramFace[]): Comparable[] {
  return placements.map((p) => ({ ...p, faceLabel: faces.find((f) => f.faceId === p.faceId)?.label ?? "Removed side" }));
}

/** Faces a version used that the fixture no longer has (spec §5.5). */
export function goneFaces(snapshot: readonly SnapshotEntry[], faces: readonly PlanogramFace[]): { label: string; count: number }[] {
  const gone = new Map<string, { label: string; count: number }>();
  for (const e of snapshot) {
    if (faces.some((f) => f.faceId === e.faceId)) continue;
    const found = gone.get(e.faceId) ?? { label: e.faceLabel, count: 0 };
    found.count += 1;
    gone.set(e.faceId, found);
  }
  return [...gone.values()];
}
