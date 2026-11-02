// Resizing a tile by an edge (Part 2 spec §4 "Resize"), from the press's start
// like a move. Spans never drop below half a foot by one level; going off the
// face or onto a neighbour is left to rules.ts. On a turned table the screen's
// left/right edges are its rows and top/bottom its columns. A turned block draws
// row 0 at its screen-right (spanRect), so there the right edge is the row
// start and the left edge the row end. Level handles show only when the face
// has more than one level: a single-level face has nothing to span.

import { ROW_UNITS, type Block } from "../set-grid";
import type { PlacementFields } from "../types";

export type Edge = "left" | "right" | "top" | "bottom";

export function resizeEdges(block: Block): Edge[] {
  const columnEdges: Edge[] = block.turned ? ["top", "bottom"] : ["left", "right"];
  const rowEdges: Edge[] = block.turned ? ["left", "right"] : ["top", "bottom"];
  return block.rows > 1 ? [...columnEdges, ...rowEdges] : columnEdges;
}

function fromStart(start: PlacementFields, at: "col" | "row", span: "colSpan" | "rowSpan", delta: number): PlacementFields {
  const end = start[at] + start[span];
  const next = Math.min(end - 1, start[at] + delta);
  return { ...start, [at]: next, [span]: end - next };
}

export function resizeTarget(block: Block, start: PlacementFields, edge: Edge, dx: number, dy: number): PlacementFields {
  const horizontal = edge === "left" || edge === "right";
  const screenDelta = horizontal ? dx : dy;
  const changesColumns = horizontal !== block.turned;
  if (changesColumns) {
    const delta = Math.round(screenDelta);
    return edge === "left" || edge === "top" ? fromStart(start, "col", "colSpan", delta) : { ...start, colSpan: Math.max(1, start.colSpan + delta) };
  }
  // Rows count the opposite way on screen when turned, so the delta flips and the edges swap.
  const delta = block.turned ? 0 - Math.round(screenDelta / ROW_UNITS) : Math.round(screenDelta / ROW_UNITS);
  const isStart = block.turned ? edge === "right" : edge === "top";
  return isStart ? fromStart(start, "row", "rowSpan", delta) : { ...start, rowSpan: Math.max(1, start.rowSpan + delta) };
}
