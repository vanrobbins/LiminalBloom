// The placement rules (spec §3, §5.3). One function decides, so the server, the
// form editor and Week 6's builder refuse exactly the same things with the
// same words.

import type { Cells } from "@/lib/products/location-label";
import type { Presentation } from "@/lib/products/footprint";
import { cellsOverlap, fitsGrid } from "@/lib/products/placement";

import { sharesSpace } from "./layers";

import { MAX_PIECES, type PlacementFields, type PlacementView, type PlanogramFace } from "./types";

export type Neighbour = Cells & { id: string; faceId: string; productName: string; presentation?: Presentation; depth?: number };

export type Refusal = { kind: "face" | "presentation" | "off-edge" | "pieces" | "overlap"; message: string; blockerId?: string };

export const HUNG_ONLY = "Frame racks hold hung product only";

export function checkPlacement(
  candidate: PlacementFields & { id: string | null },
  others: readonly Neighbour[],
  faces: readonly PlanogramFace[],
): Refusal | null {
  const face = faces.find((f) => f.faceId === candidate.faceId);
  if (!face) return { kind: "face", message: "No longer in this set" };
  // One rail, so hung only (frame racks spec §3); its one row keeps rowSpan at 1 via the edge check.
  if (face.fixtureType === "frame_rack" && candidate.presentation === "folded") return { kind: "presentation", message: HUNG_ONLY };
  if (!fitsGrid(candidate, face)) return { kind: "off-edge", message: "Off the edge of the face" };
  if (!Number.isInteger(candidate.pieceCount) || candidate.pieceCount < 1) return { kind: "pieces", message: "At least 1 piece" };
  // No per-product stack limit (Week 6.5 spec §3.3): hung and folded both stop at MAX_PIECES.
  if (candidate.pieceCount > MAX_PIECES) return { kind: "pieces", message: `At most ${MAX_PIECES} pieces` };
  // Hung on hung may share rail space, front to back (DECISIONS 11-09); anything with folded may not.
  const blocker = others.find(
    (o) => o.id !== candidate.id && o.faceId === candidate.faceId && cellsOverlap(candidate, o) && !(candidate.presentation === "hung" && o.presentation === "hung"),
  );
  if (blocker) return { kind: "overlap", message: `Blocked by ${blocker.productName}`, blockerId: blocker.id };
  return null;
}

/** Why each placement can't be published; an overlap or a shared layer is reported on the later of the two. */
export function draftIssues(placements: readonly PlacementView[], faces: readonly PlanogramFace[]): Map<string, string> {
  const issues = new Map<string, string>();
  placements.forEach((p, i) => {
    const earlier = placements.slice(0, i);
    const refusal = checkPlacement(p, earlier, faces);
    if (refusal) issues.set(p.id, refusal.message);
    // The server renumbers every save, so a tie means a row was written some other way: never trust it.
    const tie = refusal ? undefined : earlier.find((o) => sharesSpace(p, o) && o.depth === p.depth);
    if (tie) issues.set(p.id, `Same layer as ${tie.productName}`);
  });
  return issues;
}
