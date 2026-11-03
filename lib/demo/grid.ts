// The fixture grid's rules for the demo: a spot must sit inside the face and
// overlap nothing. A refusal names what is in the way, as the real builder does.

import type { Face, Placement, Presentation, Product, Size } from "./types";

export type Spot = { faceId: string; col: number; row: number; w: number; h: number };

export type Check = { ok: true } | { ok: false; reason: "edge" } | { ok: false; reason: "blocked"; by: Placement };

function overlaps(a: Spot, b: Spot) {
  return a.faceId === b.faceId && a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;
}

/** Whether `spot` fits on `face` among `others` (leave the moving placement out of them). */
export function checkSpot(face: Face, others: Placement[], spot: Spot): Check {
  if (spot.col < 0 || spot.row < 0 || spot.col + spot.w > face.cols || spot.row + spot.h > face.rows) {
    return { ok: false, reason: "edge" };
  }
  const by = others.find((other) => overlaps(other, spot));
  return by ? { ok: false, reason: "blocked", by } : { ok: true };
}

/** The first open spot, row by row from the top left, or null when nothing fits. */
export function firstFit(face: Face, placements: Placement[], size: Size): Spot | null {
  for (let row = 0; row + size.h <= face.rows; row += 1) {
    for (let col = 0; col + size.w <= face.cols; col += 1) {
      const spot = { faceId: face.id, col, row, ...size };
      if (checkSpot(face, placements, spot).ok) return spot;
    }
  }
  return null;
}

export function sizeFor(product: Product, presentation: Presentation): Size {
  return presentation === "hung" ? product.hung : product.folded;
}

/** Racks hang product; walls and tables hold it folded. */
export function presentationFor(kind: "wall" | "rack" | "table"): Presentation {
  return kind === "rack" ? "hung" : "folded";
}
