// Where a dropped tile waits for its save (Part 2 spec §4). A valid drop is
// drawn where it landed until the save is back; only a refusal snaps it home,
// so a bounce always means "refused". A started draft renames the tile on the
// way, and the landing follows it.

"use client";

import { useState } from "react";

import type { PlacementFields } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";

type Landing = { id: string; fields: PlacementFields };

export function usePendingLanding() {
  const [landing, setLanding] = useState<Landing | null>(null);

  function hold(id: string, fields: PlacementFields, commit: (onFound: (id: string) => void) => Promise<unknown>) {
    let mine: Landing = { id, fields };
    setLanding(mine);
    // Only this drop's landing: a later drop holds its own.
    const replace = (next: Landing | null) => {
      const was = mine;
      if (next) mine = next;
      setLanding((current) => (current === was ? next : current));
    };
    commit((found) => {
      if (found !== mine.id) replace({ id: found, fields });
    })
      .catch(() => {})
      .finally(() => replace(null));
  }

  return {
    hold,
    isHeld: (id: string) => landing?.id === id,
    draw: (items: readonly GridItem[]): readonly GridItem[] =>
      landing ? items.map((item) => (item.id === landing.id ? { ...item, ...landing.fields } : item)) : items,
  };
}
