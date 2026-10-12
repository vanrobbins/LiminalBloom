// What the grid and the list draw, from a version or from the draft, and which
// face they open on.

import type { Presentation } from "@/lib/products/footprint";
import type { Cells } from "@/lib/products/location-label";
import type { DraftState, PlacementView, PlanogramScope, ProductLook, SnapshotEntry } from "@/lib/planograms/types";

export type GridItem = Cells & {
  id: string;
  faceId: string;
  productId: string;
  productName: string;
  styleNumber: string;
  presentation: Presentation;
  pieceCount: number;
  imageKey: string | null;
  categoryName: string;
};

/** A product deleted since publishing has no look: it keeps its snapshot name and gets the default silhouette. */
export function itemsFromSnapshot(entries: readonly SnapshotEntry[], looks: Readonly<Record<string, ProductLook>>): GridItem[] {
  return entries.map((e, i) => ({ ...e, id: `v-${i}`, imageKey: looks[e.productId]?.imageKey ?? null, categoryName: looks[e.productId]?.categoryName ?? "" }));
}

export function itemsFromDraft(placements: readonly PlacementView[]): GridItem[] {
  return placements.map((p) => ({ ...p }));
}

/** The face holding ?product (the shown version first, else the draft), else the first face. */
export function startFace(scope: PlanogramScope, shown: readonly SnapshotEntry[], draft: DraftState | null, productId: string | null): string {
  const holder = productId ? (shown.find((p) => p.productId === productId) ?? draft?.placements.find((p) => p.productId === productId)) : undefined;
  return scope.faces.find((f) => f.faceId === holder?.faceId)?.faceId ?? scope.faces[0].faceId;
}
