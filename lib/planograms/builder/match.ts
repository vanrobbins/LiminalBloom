// The first change with no draft starts one from the published version, which
// gives every placement a new id (restore.ts). The tile the person moved is
// found in the new draft by what it is and where it sits; if another device
// has already moved it, there's no match and the move is refused
// (Review Focus 3). Pieces aren't compared: a restore may cap them.

import type { PlacementFields, PlacementView } from "../types";

export function matchPlacement(tile: PlacementFields & { productId: string }, placements: readonly PlacementView[]): PlacementView | null {
  return (
    placements.find(
      (p) =>
        p.faceId === tile.faceId &&
        p.productId === tile.productId &&
        p.presentation === tile.presentation &&
        p.col === tile.col &&
        p.row === tile.row &&
        p.colSpan === tile.colSpan &&
        p.rowSpan === tile.rowSpan,
    ) ?? null
  );
}
