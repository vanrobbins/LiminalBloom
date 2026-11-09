// The shapes planograms are made of (spec §3). Types and constants only.

import type { FaceSide, FixtureType, Side } from "@/lib/layout/types";
import type { Footprint, Presentation } from "@/lib/products/footprint";
import type { Cells } from "@/lib/products/location-label";
import type { Texture } from "@/lib/products/schemas";

/** Pieces per placement. Hung products share rail space as separate placements (layers.ts), so this caps each one. */
export const MAX_PIECES = 99;

/** Before 2000 is a half-typed year (a date field reads "0002-10-15" after one digit). */
export const EARLIEST_DUE_DATE = "2000-01-01";

/**
 * `depth` orders hung products sharing rail space, 0 = front (layers.ts). In a
 * change it asks for a place in its layer group; left out, the server keeps the
 * placement's own, or puts it at the back when it joins others.
 */
export type PlacementFields = Cells & { faceId: string; presentation: Presentation; pieceCount: number; depth?: number };

/** A draft row. */
export type Placement = PlacementFields & { id: string; productId: string; version: number; depth: number };

/**
 * What a tile draws a product with (Week 6.5 spec §4.6): its photo key, else a
 * drawing from its category, tinted by its swatch or colour word, with its
 * texture. The drawing fields are optional: a product deleted since
 * publishing has none and draws neutral.
 */
export type ProductLook = { imageKey: string | null; categoryName: string; swatch?: string | null; texture?: Texture; colorWord?: string };

/** A draft row with what the screens show beside it. */
export type PlacementView = Placement & ProductLook & { productName: string; styleNumber: string };

/** One face a planogram covers. `label` names it on screen: "Front", "Upper", "Front table". */
export type PlanogramFace = {
  faceId: string;
  fixtureId: string;
  fixtureName: string;
  /** The face's own fixture's type: a wall bay's levels are shelves or rails, a table's are front to back. */
  fixtureType: FixtureType;
  side: FaceSide;
  /** The lower table's side of its set; null for the planogram fixture's own faces. */
  setSide: Side | null;
  label: string;
  /** A frame rack that turns a corner from the rack before it. */
  corner?: boolean;
  columns: number;
  rows: number;
};

/** `isSet` means the faces show together on one combined grid: a table set, or (with `isRun`) a frame rack run. */
export type PlanogramScope = { fixtureId: string; fixtureName: string; isSet: boolean; isRun?: boolean; faces: PlanogramFace[] };

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
