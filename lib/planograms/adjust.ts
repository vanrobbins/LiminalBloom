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

/** The fields that name a tile in a version: what a change is sent with (the rest comes from the version). */
export type TargetRef = Pick<AdjustTarget, "faceId" | "productId" | "col" | "row" | "depth">;

/** A change as stored: its row's id and version go with it (the version guards a save of just this tile). */
export type ChangeRow = AdjustChange & { id: string; version: number };

/** One draft or published adjustment, with its changes. `version` guards a publish of it. */
export type AdjustmentState = {
  id: string;
  planogramId: string;
  state: "draft" | "published";
  basedOnVersion: number;
  version: number;
  createdByName: string;
  createdAt: Date;
  publishedAt: Date | null;
  publishedByName: string | null;
  changes: ChangeRow[];
};
export type Adjustments = { draft: AdjustmentState | null; published: AdjustmentState | null };

/** One change per target: the database's unique key, face + cell + depth + product. */
export function targetKey(t: TargetRef): string {
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

/** An open adjustment a full publish ends, in words' source for its dialog: each change's place and the two products. */
export type EndingAdjustment = {
  adjustmentId: string;
  state: "draft" | "published";
  changes: { kind: "replace" | "empty"; fixtureName: string; faceLabel: string; from: string; to: string | null }[];
};

/** The published adjustment first (it is on the floor), then the draft; one with no changes has nothing to list. */
export function endingAdjustments(open: Adjustments, latest: readonly SnapshotEntry[]): EndingAdjustment[] {
  return [open.published, open.draft].flatMap((a): EndingAdjustment[] => {
    const changes = (a?.changes ?? []).flatMap((c) => {
      const tile = latest.find((e) => targetKey(e) === targetKey(c.target));
      return tile ? [{ kind: c.kind, fixtureName: tile.fixtureName, faceLabel: tile.faceLabel, from: tile.productName, to: c.kind === "replace" ? c.replacement.productName : null }] : [];
    });
    return a && changes.length > 0 ? [{ adjustmentId: a.id, state: a.state, changes }] : [];
  });
}
