// Trash on the grid (0.7.0.5 spec §2.3): no dialog. The tile fades and shrinks
// for 150 ms, then the removal is sent; a refusal brings it back (the status
// line says why, use-planogram-draft.ts). One removal at a time, however often
// the key or the disc is pressed, and until the grid has dropped the tile.

"use client";

import { useRef, useState } from "react";

import type { GridItem } from "./grid-items";

/** The tile's fade-out (--animate-tile-out). */
const FADE_MS = 150;

/** `onRemove` resolves true once the tile is gone, false if the change was refused. `items` are the ids the grid has: a leaving tile is forgotten once it is not among them. */
export function useTileRemoval(onRemove: ((item: GridItem) => Promise<boolean>) | undefined, items: readonly GridItem[]) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const busy = useRef(false);
  // Gone from the grid: nothing is leaving any more, so the same id coming back is an ordinary tile (adjusted during render).
  if (leaving !== null && !items.some((i) => i.id === leaving)) setLeaving(null);

  function remove(item: GridItem) {
    // A removal that went through keeps `leaving` set until the grid drops the tile: a second press is nothing.
    if (!onRemove || busy.current || leaving !== null) return;
    busy.current = true;
    setLeaving(item.id);
    const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : FADE_MS;
    new Promise((resolve) => setTimeout(resolve, wait))
      .then(() => onRemove(item))
      // Removed: it stays faded until the grid drops it. Refused or failed: it comes back.
      .then((removed) => (removed ? undefined : setLeaving(null)), () => setLeaving(null))
      .finally(() => {
        busy.current = false;
      });
  }

  return { leaving, remove };
}
