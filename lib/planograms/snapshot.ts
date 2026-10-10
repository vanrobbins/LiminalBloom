// A published version's placements (spec §3.1). Checked by the same schema on
// the way in and on the way out, so a bad row can never reach a screen.

import { z } from "zod";

import { FACE_SIDES } from "@/lib/layout/types";
import { PRESENTATIONS } from "@/lib/products/footprint";

import { MAX_PIECES, type PlacementView, type PlanogramFace, type SnapshotEntry } from "./types";

const cell = z.int().min(0).max(23);
const span = z.int().min(1).max(24);

export const snapshotSchema = z.array(
  z.object({
    faceId: z.uuid(),
    faceLabel: z.string(),
    side: z.enum(FACE_SIDES),
    fixtureId: z.uuid(),
    fixtureName: z.string(),
    productId: z.uuid(),
    productName: z.string(),
    styleNumber: z.string(),
    presentation: z.enum(PRESENTATIONS),
    col: cell,
    row: cell,
    colSpan: span,
    rowSpan: span,
    pieceCount: z.int().min(1).max(MAX_PIECES),
  }),
);

export function parseSnapshot(raw: unknown): SnapshotEntry[] {
  return snapshotSchema.parse(raw);
}

export function buildSnapshot(placements: readonly PlacementView[], faces: readonly PlanogramFace[]): SnapshotEntry[] {
  const order = new Map(faces.map((f, i) => [f.faceId, i]));
  const entries = placements.map((p): SnapshotEntry => {
    const face = faces.find((f) => f.faceId === p.faceId);
    if (!face) throw new Error(`Placement ${p.id} is on a face outside this planogram.`);
    return {
      faceId: p.faceId,
      faceLabel: face.label,
      side: face.side,
      fixtureId: face.fixtureId,
      fixtureName: face.fixtureName,
      productId: p.productId,
      productName: p.productName,
      styleNumber: p.styleNumber,
      presentation: p.presentation,
      col: p.col,
      row: p.row,
      colSpan: p.colSpan,
      rowSpan: p.rowSpan,
      pieceCount: p.pieceCount,
    };
  });
  return snapshotSchema.parse(
    entries.sort((a, b) => (order.get(a.faceId) ?? 0) - (order.get(b.faceId) ?? 0) || a.row - b.row || a.col - b.col),
  );
}
