// Where something goes when the person doesn't say (Part 2 spec §4 "Add",
// "Move to face…"): the first open spot that fits, faces in the order given
// (the shown face first), top-left first, by placement.ts's own rule.

import { firstFreeSpot } from "@/lib/products/placement";

import { checkPlacement, type Neighbour } from "../rules";
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
    for (const face of faces) {
      // A frame rack's rail takes hung product only, one row high (frame racks spec §3).
      const rail = face.fixtureType === "frame_rack";
      if (rail && presentation === "folded") continue;
      const rowSpan = rail ? 1 : rows;
      const spot = firstOpenSpot([face], others, { colSpan: columns, rowSpan }, null);
      if (spot) return { ...spot, presentation, colSpan: columns, rowSpan, pieceCount: 1 };
    }
  }
  return null;
}

/**
 * Where the person pointed: the product's top-left corner on that cell, folded first, if the rules allow it there
 * (checkPlacement: on the face, clear of everything else); null otherwise, and the caller falls back to placeNew.
 */
export function placeAt(
  faces: readonly PlanogramFace[],
  others: readonly Neighbour[],
  product: ProductFit,
  cell: { faceId: string; col: number; row: number },
): PlacementFields | null {
  const face = faces.find((f) => f.faceId === cell.faceId);
  if (!face) return null;
  for (const presentation of ["folded", "hung"] as const) {
    const { columns, rows } = product.footprints[presentation];
    // A frame rack's rail takes hung product only, on its one row (frame racks spec §3).
    const rail = face.fixtureType === "frame_rack";
    if (rail && presentation === "folded") continue;
    const fields: PlacementFields = { faceId: face.faceId, presentation, col: cell.col, row: rail ? 0 : cell.row, colSpan: columns, rowSpan: rail ? 1 : rows, pieceCount: 1 };
    if (!checkPlacement({ ...fields, id: null }, others, faces)) return fields;
  }
  return null;
}
