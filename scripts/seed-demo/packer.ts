// Places the demo's products on fixture faces in a fixed order (spec §6.3), so
// every run gives the same store. Every spot comes from placement.ts, the same
// rules the Week 5 builder will use.

import type { Presentation } from "@/lib/products/footprint";
import { firstFreeSpot, type Grid } from "@/lib/products/placement";

export type FaceSlot = { faceId: string; grid: Grid; accepts: readonly Presentation[] };
export type PlaceRequest = { productId: string; presentation: Presentation; columns: number; rows: number };
export type Placed = PlaceRequest & { faceId: string; col: number; row: number };

export function pack(faces: readonly FaceSlot[], requests: readonly PlaceRequest[]): { placed: Placed[]; unplaced: PlaceRequest[] } {
  const placed: Placed[] = [];
  const unplaced: PlaceRequest[] = [];
  for (const request of requests) {
    const face = faces.find((f) => {
      if (!f.accepts.includes(request.presentation)) return false;
      if (placed.some((p) => p.faceId === f.faceId && p.productId === request.productId)) return false;
      const taken = placed.filter((p) => p.faceId === f.faceId).map((p) => ({ col: p.col, row: p.row, colSpan: p.columns, rowSpan: p.rows }));
      return firstFreeSpot(f.grid, taken, request) !== null;
    });
    if (!face) {
      unplaced.push(request);
      continue;
    }
    const taken = placed.filter((p) => p.faceId === face.faceId).map((p) => ({ col: p.col, row: p.row, colSpan: p.columns, rowSpan: p.rows }));
    const spot = firstFreeSpot(face.grid, taken, request)!;
    placed.push({ ...request, faceId: face.faceId, ...spot });
  }
  return { placed, unplaced };
}
