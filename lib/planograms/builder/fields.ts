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

/**
 * A gesture's fields with everything it did not change (those equal to the tile it was built on, as rendered) taken from
 * the placement as it is when the change goes, if it still is: a typed edit sent meanwhile is kept, and only the move,
 * resize or reorder's own fields come from the gesture.
 */
export const keepUnchanged = (fields: PlacementFields, built: PlacementFields, now?: PlacementFields): PlacementFields => {
  if (!now) return fields;
  const keep = <K extends keyof PlacementFields>(key: K): PlacementFields[K] => (fields[key] === built[key] ? now[key] : fields[key]);
  return { ...fields, faceId: keep("faceId"), presentation: keep("presentation"), col: keep("col"), row: keep("row"), colSpan: keep("colSpan"), rowSpan: keep("rowSpan"), pieceCount: keep("pieceCount") };
};
