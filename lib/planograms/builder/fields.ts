// What the builder records and says about a change (Part 2 spec §4).

import type { PlacementFields } from "../types";

export type Verb = "Moved" | "Resized" | "Changed" | Reorder;
/** Move forward / Move back on a shared rail (layers.ts). */
export type Reorder = "Moved forward" | "Moved back";
export const isReorder = (verb: Verb): verb is Reorder => verb === "Moved forward" || verb === "Moved back";

/** Only a placement's own fields: a tile carries names and looks too. Its depth only when asked for (layers.ts). */
export const fieldsOf = (p: PlacementFields, withDepth = false): PlacementFields => ({
  faceId: p.faceId,
  presentation: p.presentation,
  col: p.col,
  row: p.row,
  colSpan: p.colSpan,
  rowSpan: p.rowSpan,
  pieceCount: p.pieceCount,
  ...(withDepth && p.depth !== undefined ? { depth: p.depth } : {}),
});
