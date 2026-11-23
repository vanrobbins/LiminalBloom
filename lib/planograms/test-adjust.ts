// Entries, faces and changes for the Quick Adjust tests: a face of 12 columns by 4 rows.

import type { AdjustChange } from "./adjust";
import type { PlanogramFace, SnapshotEntry } from "./types";

export const FACE: PlanogramFace = {
  faceId: "f1", fixtureId: "fx1", fixtureName: "Wall bay 3", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 4,
};

export function entry(over: Partial<SnapshotEntry> = {}): SnapshotEntry {
  return {
    faceId: "f1", faceLabel: "Front", side: "front", fixtureId: "fx1", fixtureName: "Wall bay 3", productId: "straight", productName: "Straight jean",
    styleNumber: "S-1", presentation: "folded", col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 4, depth: 0, ...over,
  };
}

/** The change for an entry, as the row would be read back. */
export function replacing(target: SnapshotEntry, productId: string, over: Partial<Extract<AdjustChange, { kind: "replace" }>> = {}): AdjustChange {
  return {
    kind: "replace", target, pieceCount: target.pieceCount,
    replacement: { productId, productName: `Name ${productId}`, styleNumber: `N-${productId}`, colSpan: target.colSpan, rowSpan: target.rowSpan }, ...over,
  };
}

export const emptying = (target: SnapshotEntry): AdjustChange => ({ kind: "empty", target });
