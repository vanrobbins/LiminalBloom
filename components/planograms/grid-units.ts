// Sizes on the planogram grid: one unit is half a foot (set-grid.ts), drawn as
// var(--cell). Shared by the tiles, their handles and the drag guides.

import type { Rect } from "@/lib/planograms/set-grid";

import type { useTileGesture } from "./use-tile-gesture";

export const at = (n: number) => `calc(var(--cell) * ${n})`;
/** A tile sits 1 px inside its space, so neighbours read as separate. */
export const placed = (r: Rect): React.CSSProperties => ({
  left: `calc(${at(r.x)} + 1px)`,
  top: `calc(${at(r.y)} + 1px)`,
  width: `calc(${at(r.width)} - 2px)`,
  height: `calc(${at(r.height)} - 2px)`,
});

export type Gestures = ReturnType<typeof useTileGesture>;

// A touch on the moving tile is the tile's alone (Review Focus 1).
export const KEEP_TOUCH = {
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  onTouchEnd: (e: React.TouchEvent) => e.stopPropagation(),
};
