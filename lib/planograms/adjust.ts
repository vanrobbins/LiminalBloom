// A Quick Adjust layer over a published version (0.7.0.9 spec §6.2), pure. A change names one
// tile of the version by its snapshot fields (entries have no id) and either swaps its product
// or leaves it empty. The floor is the version with the published changes applied.

import type { FloorPlanogram, SnapshotEntry } from "./types";

/** The tile a change is about, as it sits in the version it is pinned to. */
export type AdjustTarget = Pick<SnapshotEntry, "faceId" | "productId" | "presentation" | "col" | "row" | "colSpan" | "rowSpan" | "depth">;

/** `replace` keeps the target's place, presentation and depth; the replacement brings its own names and span. */
export type AdjustChange =
  | { kind: "empty"; target: AdjustTarget }
  | {
      kind: "replace";
      target: AdjustTarget;
      replacement: { productId: string; productName: string; styleNumber: string; colSpan: number; rowSpan: number };
      pieceCount: number;
    };

/** One change per target: the database's unique key, face + cell + depth + product. */
export function targetKey(t: Pick<AdjustTarget, "faceId" | "productId" | "col" | "row" | "depth">): string {
  return [t.faceId, t.col, t.row, t.depth ?? 0, t.productId].join("|");
}

/** The entries with the changes applied. A change whose target is no longer there is skipped and counted. */
export function applyAdjustment(snapshot: readonly SnapshotEntry[], changes: readonly AdjustChange[]): { entries: SnapshotEntry[]; skipped: number } {
  const byTarget = new Map(changes.map((c) => [targetKey(c.target), c]));
  let applied = 0;
  const entries = snapshot.flatMap((e): SnapshotEntry[] => {
    const change = byTarget.get(targetKey(e));
    if (!change) return [e];
    applied++;
    if (change.kind === "empty") return [];
    const { productId, productName, styleNumber, colSpan, rowSpan } = change.replacement;
    return [{ ...e, productId, productName, styleNumber, colSpan, rowSpan, pieceCount: change.pieceCount }];
  });
  return { entries, skipped: changes.length - applied };
}

/** What readers draw: the latest version with its published adjustment, if any. */
export function adjustedFloor(latest: FloorPlanogram["latest"], published: readonly AdjustChange[] | null): SnapshotEntry[] {
  if (!latest) return [];
  return published && published.length > 0 ? applyAdjustment(latest.placements, published).entries : [...latest.placements];
}
