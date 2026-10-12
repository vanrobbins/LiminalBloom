// The shapes planograms are made of (spec §3). Types and constants only.

import type { FaceSide, Side } from "@/lib/layout/types";
import type { Footprint, Presentation } from "@/lib/products/footprint";
import type { Cells } from "@/lib/products/location-label";

/** Hung product doesn't stack, so only this caps it (DECISIONS 10-08). */
export const MAX_PIECES = 99;

/** Before 2000 is a half-typed year (a date field reads "0002-10-15" after one digit). */
export const EARLIEST_DUE_DATE = "2000-01-01";

export type PlacementFields = Cells & { faceId: string; presentation: Presentation; pieceCount: number };

/** A draft row. */
export type Placement = PlacementFields & { id: string; productId: string; version: number };

/** A draft row with what the screens show beside it. `stackLimit` is the product's folded one. */
export type PlacementView = Placement & { productName: string; styleNumber: string; stackLimit: number; imageKey: string | null; categoryName: string };

/** What a tile draws a product with: its photo key and category (for the silhouette). */
export type ProductLook = { imageKey: string | null; categoryName: string };

/** One face a planogram covers. `label` names it on screen: "Front", "Upper", "Front table". */
export type PlanogramFace = {
  faceId: string;
  fixtureId: string;
  fixtureName: string;
  side: FaceSide;
  /** The lower table's side of its set; null for the planogram fixture's own faces. */
  setSide: Side | null;
  label: string;
  columns: number;
  rows: number;
};

export type PlanogramScope = { fixtureId: string; fixtureName: string; isSet: boolean; faces: PlanogramFace[] };

/** What the map needs of a planogram: the latest published version, and whether a draft is under way. */
export type FloorPlanogram = { hasDraft: boolean; dueDate: string | null; latest: { number: number; placements: SnapshotEntry[] } | null };

/** One placement in a published version (spec §3.1). */
export type SnapshotEntry = PlacementFields & {
  faceLabel: string;
  side: FaceSide;
  fixtureId: string;
  fixtureName: string;
  productId: string;
  productName: string;
  styleNumber: string;
};

/** What a save reply and a reload carry: the whole draft (spec §4.3, co-editing). */
export type DraftState = { planogramVersion: number; placements: PlacementView[] };

export type Change =
  | { kind: "add"; productId: string; fields: PlacementFields }
  | { kind: "update"; id: string; version: number; fields: PlacementFields }
  | { kind: "remove"; id: string; version: number };

/** A product as the add form needs it: both footprints, so switching presentation re-fills the span. */
export type ProductFit = { id: string; name: string; styleNumber: string; footprints: Record<Presentation, Footprint> };
