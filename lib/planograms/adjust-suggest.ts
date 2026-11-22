// Replacement suggestions for one tile (0.7.0.9 spec §4.3), pure. A product is eligible when it
// is in the same category, is not sold out, is not already on this display, and its footprint,
// placed where the target is, passes the placement rules against the floor without the target
// (so it may use the vacated cells and open ones beside them, never a neighbour's). Tier 1 is
// the same colour family too; within a tier the closest size comes first, then the name.

import { colorFamily } from "@/lib/products/color-family";
import type { ProductStatus } from "@/lib/product-status";

import { targetKey } from "./adjust";
import { sharesSpace } from "./layers";
import { checkPlacement } from "./rules";
import type { PlanogramFace, ProductFit, SnapshotEntry } from "./types";

export const MAX_SUGGESTIONS = 6;
export const TIER_REASON = { 1: "Same category and colour", 2: "Same category" } as const;

/** A product that might go there: its footprints, category, colour and whether it can be had. */
export type Candidate = ProductFit & { categoryId: string; color: string; swatch: string | null; status: ProductStatus };

/** The tile being replaced, with what its product looks like (snapshot entries don't carry that). */
export type SuggestTarget = { entry: SnapshotEntry; categoryId: string; color: string; swatch: string | null };

export type Suggestion = { product: Candidate; colSpan: number; rowSpan: number; tier: 1 | 2; reason: string };

const neighbour = (e: SnapshotEntry) => ({ ...e, id: targetKey(e) });

export function suggestReplacements(
  target: SuggestTarget,
  floor: readonly SnapshotEntry[],
  faces: readonly PlanogramFace[],
  candidates: readonly Candidate[],
): Suggestion[] {
  const { entry } = target;
  const onDisplay = new Set(floor.map((e) => e.productId));
  const others = floor.filter((e) => targetKey(e) !== targetKey(entry)).map(neighbour);
  const family = colorFamily(target.color, target.swatch);
  const targetArea = entry.colSpan * entry.rowSpan;

  const found = candidates.flatMap((product): (Suggestion & { distance: number })[] => {
    if (product.categoryId !== target.categoryId || product.status === "sold_out" || onDisplay.has(product.id)) return [];
    const { columns: colSpan, rows: rowSpan } = product.footprints[entry.presentation];
    // The target's top-left, presentation, pieces and rail layer; only the footprint is the product's own.
    const placed = { ...entry, id: null, colSpan, rowSpan };
    if (checkPlacement(placed, others, faces)) return [];
    // Hung products may share rail space, but never a layer: a wider one must not land on a neighbour's depth.
    const self = { ...placed, id: "candidate" };
    if (others.some((o) => sharesSpace(self, o) && (o.depth ?? 0) === (entry.depth ?? 0))) return [];
    const tier = family !== null && colorFamily(product.color, product.swatch) === family ? 1 : 2;
    return [{ product, colSpan, rowSpan, tier, reason: TIER_REASON[tier], distance: Math.abs(colSpan * rowSpan - targetArea) }];
  });

  return found
    .sort((a, b) => a.tier - b.tier || a.distance - b.distance || a.product.name.localeCompare(b.product.name) || a.product.id.localeCompare(b.product.id))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ distance: _distance, ...suggestion }) => suggestion);
}
