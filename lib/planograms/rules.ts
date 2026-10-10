// The placement rules (spec §3, §5.3). One function decides, so the server, the
// form editor and Week 6's builder refuse exactly the same things with the
// same words.

import type { Cells } from "@/lib/products/location-label";
import { cellsOverlap, fitsGrid } from "@/lib/products/placement";

import { MAX_PIECES, type PlacementFields, type PlacementView, type PlanogramFace } from "./types";

export type Neighbour = Cells & { id: string; faceId: string; productName: string };

export type Refusal = { kind: "face" | "off-edge" | "pieces" | "overlap"; message: string; blockerId?: string };

export function checkPlacement(
  candidate: PlacementFields & { id: string | null },
  others: readonly Neighbour[],
  faces: readonly PlanogramFace[],
  stackLimit: number,
): Refusal | null {
  const face = faces.find((f) => f.faceId === candidate.faceId);
  if (!face) return { kind: "face", message: "No longer in this set" };
  if (!fitsGrid(candidate, face)) return { kind: "off-edge", message: "Off the edge of the face" };
  if (!Number.isInteger(candidate.pieceCount) || candidate.pieceCount < 1) return { kind: "pieces", message: "At least 1 piece" };
  // Hung product hangs side by side; only folded product stacks (DECISIONS 10-08).
  if (candidate.presentation === "folded" && candidate.pieceCount > stackLimit) {
    return { kind: "pieces", message: `More than this product's stack limit (${stackLimit})` };
  }
  if (candidate.pieceCount > MAX_PIECES) return { kind: "pieces", message: `At most ${MAX_PIECES} pieces` };
  const blocker = others.find((o) => o.id !== candidate.id && o.faceId === candidate.faceId && cellsOverlap(candidate, o));
  if (blocker) return { kind: "overlap", message: `Blocked by ${blocker.productName}`, blockerId: blocker.id };
  return null;
}

/** Why each placement can't be published; an overlap is reported on the later of the two. */
export function draftIssues(placements: readonly PlacementView[], faces: readonly PlanogramFace[]): Map<string, string> {
  const issues = new Map<string, string>();
  placements.forEach((p, i) => {
    const refusal = checkPlacement(p, placements.slice(0, i), faces, p.stackLimit);
    if (refusal) issues.set(p.id, refusal.message);
  });
  return issues;
}
