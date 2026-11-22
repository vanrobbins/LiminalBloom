// What the adjust screen asks the server for besides the draft itself (0.7.0.9 spec §4.3, §5.3): ranked replacement
// suggestions for one tile, and the data for Compare. Reads only.

import "server-only";

import { adjustedFloor, applyAdjustment, targetKey, type AdjustmentState, type TargetRef } from "./adjust";
import { loadAdjustments, loadCandidates, productLook } from "./adjust-queries";
import { suggestReplacements, type Suggestion } from "./adjust-suggest";
import { diffPlacements, sortByFaceOrder, type FaceChanges } from "./diff";
import { loadPlanogram } from "./queries";
import type { SnapshotEntry } from "./types";
import { scopeFor } from "./write-core";

/** A suggestion as the screen needs it: the product, the footprint it would take and why it is listed. */
export type SuggestionView = { productId: string; name: string; styleNumber: string; colSpan: number; rowSpan: number; tier: 1 | 2; reason: string };
const toView = (s: Suggestion): SuggestionView => ({ productId: s.product.id, name: s.product.name, styleNumber: s.product.styleNumber, colSpan: s.colSpan, rowSpan: s.rowSpan, tier: s.tier, reason: s.reason });

/** Up to 6 ranked replacements for the tile, against the adjusted floor without that tile's own change; null when the tile is not in the version. */
export async function suggestionsFor(storeId: string, fixtureId: string, ref: TargetRef): Promise<SuggestionView[] | null> {
  const scope = await scopeFor(storeId, fixtureId);
  const { row, latest } = await loadPlanogram(storeId, fixtureId);
  if (!scope || !row || !latest) return null;
  const entry = latest.placements.find((e) => targetKey(e) === targetKey(ref));
  const look = entry ? await productLook(storeId, entry.productId) : null;
  if (!entry || !look) return null;
  const { draft, published } = await loadAdjustments(storeId, row.id);
  const changes = (draft ?? published)?.changes ?? [];
  const floor = applyAdjustment(latest.placements, changes.filter((c) => targetKey(c.target) !== targetKey(entry))).entries;
  const candidates = await loadCandidates(storeId, { categoryId: look.categoryId });
  return suggestReplacements({ entry, ...look }, floor, scope.faces, candidates).map(toView);
}

export type AdjustPreview = {
  kind: "draft" | "published";
  adjustmentId: string;
  version: number;
  basedOnVersion: number;
  /** The change list in words' source: faces in the planogram's own order. */
  changes: FaceChanges[];
  before: SnapshotEntry[];
  after: SnapshotEntry[];
};

/** Compare's data: the draft against its version, else the published adjustment against its version; null with neither. */
export async function previewAdjustment(storeId: string, fixtureId: string): Promise<AdjustPreview | null> {
  const scope = await scopeFor(storeId, fixtureId);
  const { row, latest } = await loadPlanogram(storeId, fixtureId);
  if (!scope || !row || !latest) return null;
  const { draft, published } = await loadAdjustments(storeId, row.id);
  const adjustment = draft ?? published;
  if (!adjustment) return null;
  const after = adjustedFloor(latest, adjustment.changes);
  return {
    kind: adjustment.state,
    adjustmentId: adjustment.id,
    version: adjustment.version,
    basedOnVersion: adjustment.basedOnVersion,
    changes: sortByFaceOrder(diffPlacements(latest.placements, after), scope.faces.map((f) => f.faceId)),
    before: latest.placements,
    after,
  };
}

/** The draft Quick Adjust of a fixture's planogram, with its changes (what every write's reply carries back). */
export async function draftOf(storeId: string, fixtureId: string): Promise<AdjustmentState | null> {
  const { row } = await loadPlanogram(storeId, fixtureId);
  return row ? (await loadAdjustments(storeId, row.id)).draft : null;
}
