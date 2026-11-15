// A stand-in for the server's save, for tests: the change applied with the depths `layersAfter` settles
// (what write.ts writes), so a test sees a real rail order change by change.

import { layersAfter } from "./layer-depths";
import type { Change, PlacementFields, PlacementView } from "./types";

export type Row = PlacementView;

export const rowAt = (id: string, col: number, colSpan: number, depth: number, over: Partial<Row> = {}): Row => ({
  id, productId: `p-${id}`, version: 1, faceId: "f", presentation: "hung", col, row: 0, colSpan, rowSpan: 1, pieceCount: 1, depth, productName: id, styleNumber: id, imageKey: null, categoryName: "", ...over,
});

export const fieldsOf = ({ faceId, presentation, col, row, colSpan, rowSpan, pieceCount, depth }: PlacementFields): PlacementFields => ({ faceId, presentation, col, row, colSpan, rowSpan, pieceCount, depth });

/** The rows after `change`; an add is written under `newId`. */
export function serve(rows: readonly Row[], change: Change, newId = "new"): Row[] {
  const layers = layersAfter(rows, change);
  const settled = rows.map((r) => ({ ...r, depth: layers.others.find(([id]) => id === r.id)?.[1] ?? r.depth }));
  if (change.kind === "add") return [...settled, { ...rowAt(newId, 0, 1, layers.depth, { productId: change.productId }), ...change.fields, id: newId, depth: layers.depth }];
  if (change.kind === "remove") return settled.filter((r) => r.id !== change.id);
  return settled.map((r) => (r.id === change.id ? { ...r, ...change.fields, depth: layers.depth, version: r.version + 1 } : r));
}

export const depthsOf = (rows: readonly Row[]) => Object.fromEntries(rows.map((r) => [r.id, r.depth]));
