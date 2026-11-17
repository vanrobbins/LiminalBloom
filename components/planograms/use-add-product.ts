// Add product's wiring (Part 2 spec §4 "Add"; 0.7.0.5 task 7): the product goes where the person tapped when the rules
// allow it there, else at the first open spot that fits (the shown face first), and the status line says which. With
// no draft the add starts one. Split from use-placement-actions.ts for the 200-line rule.

"use client";

import { useRef } from "react";

import { placeAt, placeNew } from "@/lib/planograms/builder/place";
import type { Neighbour } from "@/lib/planograms/rules";
import type { PlacementView, PlanogramFace, PlanogramScope, ProductFit } from "@/lib/planograms/types";

import type { Cell } from "./grid-builder";
import type { GridItem } from "./grid-items";
import type { useBuilder } from "./use-builder";
import { spotWords } from "./use-placement-actions";

export const NEAREST_SPOT = "Placed at the nearest open spot";

type Options = {
  scope: PlanogramScope;
  face: PlanogramFace;
  placements: readonly PlacementView[];
  items: readonly GridItem[];
  isEditing: boolean;
  builder: ReturnType<typeof useBuilder>;
  select: (id: string | null) => void;
  showFace: (faceId: string) => void;
  /** Words on the draft's status line, beside Saved. */
  note: (message: string) => void;
};

export function useAddProduct({ scope, face, placements, items, isEditing, builder, select, showFace, note }: Options) {
  // The tile an Add just placed: focus goes to it when the dialog closes.
  const added = useRef<string | null>(null);

  /** `cell`: where the person tapped; none for + and Enter, which mean the first open spot. */
  async function addProduct(product: ProductFit, cell?: Cell | null): Promise<string | null> {
    // Nowhere to go: say so before a draft is started for it. With no draft the add starts one, and the spot is
    // picked again among that draft's placements, which may differ from the tiles shown.
    const faces = [face, ...scope.faces.filter((f) => f.faceId !== face.faceId)];
    // Whether the last pick had to leave the tapped cell: the one that is saved is the last one made.
    let moved = false;
    const pick = (others: readonly Neighbour[]) => {
      const there = cell ? placeAt(scope.faces, others, product, cell) : null;
      moved = cell != null && there === null;
      return there ?? placeNew(faces, others, product) ?? `No open spot fits ${product.name}. Make room, then add it.`;
    };
    const first = pick(isEditing ? placements : items);
    if (typeof first === "string") return first;
    const result = await builder.add(product.id, pick);
    if (!result.saved) return result.message ?? "Couldn't add it. Try again.";
    const placed = result.draft.placements.find((p) => p.id === result.id);
    if (placed) {
      added.current = placed.id;
      select(placed.id);
      if (!scope.isSet && placed.faceId !== face.faceId) showFace(placed.faceId);
      builder.say(`Added ${product.name} at ${spotWords(scope.faces, placed)}`);
      if (moved) note(NEAREST_SPOT);
    }
    return null;
  }

  /** The Add dialog's close: focus the placed tile, not the opener (hidden on a phone while a tile is selected). */
  function focusAdded(event: Event) {
    const id = added.current;
    added.current = null;
    const tile = id ? document.querySelector<HTMLElement>(`[data-placement="${CSS.escape(id)}"]`) : null;
    if (!tile) return;
    event.preventDefault();
    tile.focus();
    tile.scrollIntoView?.({ block: "nearest", inline: "center" });
  }

  return { addProduct, focusAdded };
}
