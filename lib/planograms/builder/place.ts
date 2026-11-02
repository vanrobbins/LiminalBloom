// Where something goes when the person doesn't say (Part 2 spec §4 "Add",
// "Move to face…"): the first open spot that fits, faces in the order given
// (the shown face first), top-left first, by placement.ts's own rule.

import { firstFreeSpot } from "@/lib/products/placement";

import type { Neighbour } from "../rules";
import type { PlacementFields, PlanogramFace, ProductFit } from "../types";

export function firstOpenSpot(
  faces: readonly PlanogramFace[],
  others: readonly Neighbour[],
  size: { colSpan: number; rowSpan: number },
  excludeId: string | null,
): { faceId: string; col: number; row: number } | null {
  for (const face of faces) {
    const taken = others.filter((o) => o.faceId === face.faceId && o.id !== excludeId);
    const spot = firstFreeSpot(face, taken, { columns: size.colSpan, rows: size.rowSpan });
    if (spot) return { faceId: face.faceId, ...spot };
  }
  return null;
}

export function placeNew(faces: readonly PlanogramFace[], others: readonly Neighbour[], product: ProductFit): PlacementFields | null {
  for (const presentation of ["folded", "hung"] as const) {
    const { columns, rows } = product.footprints[presentation];
    const spot = firstOpenSpot(faces, others, { colSpan: columns, rowSpan: rows }, null);
    if (spot) return { ...spot, presentation, colSpan: columns, rowSpan: rows, pieceCount: 1 };
  }
  return null;
}
