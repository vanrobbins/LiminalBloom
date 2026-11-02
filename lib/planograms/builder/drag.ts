// Moving a tile (Part 2 spec §4 "Move"). The landing spot is rebuilt from the
// press's start every frame (store-map rule, DECISIONS 09-30), snapped to half
// feet and levels. The tile's centre picks the face, so in a table set it may
// land on another top; its span keeps its meaning (columns along that face).
// Whether it may land there is only ever rules.ts.

import { blockAt, ROW_UNITS, spanRect, type GridLayout } from "../set-grid";
import type { PlacementFields } from "../types";

export function dragTarget(layout: GridLayout, start: PlacementFields, dx: number, dy: number): PlacementFields | null {
  const from = layout.blocks.find((b) => b.faceId === start.faceId);
  if (!from) return null;
  const rect = spanRect(from, start);
  const centreX = rect.x + dx + rect.width / 2;
  const centreY = rect.y + dy + rect.height / 2;
  const target = blockAt(layout.blocks, centreX, centreY);
  if (!target) return null;
  // The tile as drawn on the target face, kept centred where the pointer has it.
  const width = target.turned ? start.rowSpan * ROW_UNITS : start.colSpan;
  const height = target.turned ? start.colSpan : start.rowSpan * ROW_UNITS;
  const left = centreX - width / 2 - target.x;
  const top = centreY - height / 2 - target.y;
  const col = Math.round(target.turned ? top : left);
  // A turned block draws its row 0 at the far side (spanRect), so count rows back from there.
  const row = target.turned ? target.rows - start.rowSpan - Math.round(left / ROW_UNITS) : Math.round(top / ROW_UNITS);
  return { ...start, faceId: target.faceId, col, row };
}
