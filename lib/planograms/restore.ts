// Turning a version back into a draft (spec §4.6). Whatever no longer fits the
// floor as it is now is skipped and counted, never forced in.

import { settleDepths } from "./layers";
import { checkPlacement, type Neighbour } from "./rules";
import type { PlacementFields, PlanogramFace, ProductFit, SnapshotEntry } from "./types";

export type RestoredRow = PlacementFields & { productId: string };
export type Skipped = { product: number; face: number; fit: number };

export function restoreRows(
  snapshot: readonly SnapshotEntry[],
  faces: readonly PlanogramFace[],
  products: ReadonlyMap<string, ProductFit>,
): { rows: RestoredRow[]; skipped: Skipped } {
  const rows: RestoredRow[] = [];
  const placed: Neighbour[] = [];
  const skipped: Skipped = { product: 0, face: 0, fit: 0 };
  snapshot.forEach((e, i) => {
    const product = products.get(e.productId);
    if (!product) {
      skipped.product += 1;
      return;
    }
    if (!faces.some((f) => f.faceId === e.faceId)) {
      skipped.face += 1;
      return;
    }
    // Piece counts come back as stored: there is no stack limit to clamp to any
    // more (Week 6.5 spec §3.3), and the snapshot schema already caps them at 99.
    const fields: PlacementFields = { faceId: e.faceId, presentation: e.presentation, col: e.col, row: e.row, colSpan: e.colSpan, rowSpan: e.rowSpan, pieceCount: e.pieceCount, depth: e.depth ?? 0 };
    if (checkPlacement({ ...fields, id: null }, placed, faces)) {
      skipped.fit += 1;
      return;
    }
    rows.push({ productId: e.productId, ...fields });
    placed.push({ ...fields, id: `restored-${i}`, productName: product.name });
  });
  // Anything skipped leaves a gap in its layer group: renumber, keeping the order.
  const depths = settleDepths(rows.map((r, i) => ({ ...r, id: String(i) })));
  return { rows: rows.map((r, i) => ({ ...r, depth: depths.get(String(i)) ?? 0 })), skipped };
}

const REASONS: [keyof Skipped, string][] = [
  ["product", "no longer in the library"],
  ["face", "its side is no longer on the fixture"],
  ["fit", "no longer fits"],
];

export function restoreMessage(number: number, skipped: Skipped): string {
  const parts = REASONS.filter(([key]) => skipped[key] > 0).map(
    ([key, why]) => `${skipped[key]} ${skipped[key] === 1 ? "product" : "products"} skipped: ${why}.`,
  );
  return [`Restored version ${number} as a draft.`, ...parts].join(" ");
}
