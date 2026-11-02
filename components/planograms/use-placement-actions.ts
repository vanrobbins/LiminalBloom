// What Planogram Detail does to a placement (Part 2 spec §4): the grid's
// builder (check, drop, arrow keys), Remove, Move to face… and Add product.
// The screen holds the state; this is its wiring, with no JSX.

"use client";

import { useRef } from "react";

import { keyTarget } from "@/lib/planograms/builder/keys";
import { firstOpenSpot, placeNew } from "@/lib/planograms/builder/place";
import { checkPlacement } from "@/lib/planograms/rules";
import { spotOf, type GridLayout } from "@/lib/planograms/set-grid";
import { MAX_PIECES, type Change, type PlacementFields, type PlacementView, type PlanogramFace, type PlanogramScope, type ProductFit } from "@/lib/planograms/types";
import { shortSpot } from "@/lib/products/location-words";
import { toast } from "@/lib/toast";

import type { GridItem } from "./grid-items";
import type { GridBuilder } from "./planogram-grid";
import type { useBuilder, Verb } from "./use-builder";
import type { SaveResult } from "./use-planogram-draft";

/** Where a placement sits, for a screen reader: "4–6 ft, Top shelf". */
export function spotWords(faces: readonly PlanogramFace[], fields: PlacementFields): string {
  const on = faces.find((f) => f.faceId === fields.faceId);
  return on ? shortSpot(spotOf(on, fields)).replace(" · ", ", ") : "";
}

type Options = {
  scope: PlanogramScope;
  face: PlanogramFace;
  layout: GridLayout;
  placements: readonly PlacementView[];
  items: readonly GridItem[];
  isEditing: boolean;
  canMove: boolean;
  selectedPlacement: PlacementView | null;
  builder: ReturnType<typeof useBuilder>;
  save: (change: Change) => Promise<SaveResult>;
  setSelectedId: (id: string | null) => void;
  /** Selects and keeps the open panel on the selection; null also closes it. */
  select: (id: string | null) => void;
  showFace: (faceId: string) => void;
};

export function usePlacementActions({ scope, face, layout, placements, items, isEditing, canMove, selectedPlacement, builder, save, setSelectedId, select, showFace }: Options) {
  // The tile an Add just placed: focus goes to it when the dialog closes.
  const added = useRef<string | null>(null);

  function check(item: GridItem, fields: PlacementFields): string | null {
    // In the draft, its rows and stack limits; on the published version, its tiles (a move never changes pieces).
    const others = isEditing ? placements : items;
    const stackLimit = (isEditing ? placements.find((p) => p.id === item.id)?.stackLimit : undefined) ?? MAX_PIECES;
    return checkPlacement({ ...fields, id: item.id }, others, scope.faces, stackLimit)?.message ?? null;
  }

  async function change(item: GridItem, fields: PlacementFields, verb: Verb): Promise<string | null> {
    const result = await builder.commit(item, fields, verb);
    if (!result.ok) return result.message;
    setSelectedId(result.id);
    if (!scope.isSet && fields.faceId !== face.faceId) showFace(fields.faceId);
    return null;
  }

  const gridBuilder: GridBuilder | undefined = canMove
    ? {
        canMove: true,
        check,
        onCommit: (item, fields, verb) => void change(item, fields, verb),
        onRefused: (message) => toast({ tone: "error", title: message }),
        onKey: (item, key, shift) => {
          const next = keyTarget(layout, item, key, shift);
          if (!next) return;
          const reason = check(item, next);
          if (reason) return builder.say(reason);
          void change(item, next, shift ? "Resized" : "Moved");
        },
        onEmpty: () => select(null),
        onDragging: builder.setDragging,
      }
    : undefined;

  function remove(p: PlacementView) {
    select(null);
    // The tile is gone once this lands: leave focus on the grid, not the page top.
    void save({ kind: "remove", id: p.id, version: p.version }).then((result) => {
      if (result.saved) requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-planogram-grid]")?.focus());
    });
  }

  function moveToFace(target: string) {
    if (!selectedPlacement) return;
    const to = scope.faces.find((f) => f.faceId === target);
    const spot = to ? firstOpenSpot([to], placements, selectedPlacement, selectedPlacement.id) : null;
    if (!spot) return toast({ tone: "error", title: `No open spot fits on ${to?.label ?? "that face"}` });
    void change(selectedPlacement, { ...selectedPlacement, ...spot }, "Moved");
  }

  async function addProduct(product: ProductFit): Promise<string | null> {
    const fields = placeNew([face, ...scope.faces.filter((f) => f.faceId !== face.faceId)], placements, product);
    if (!fields) return `No open spot fits ${product.name}. Make room, then add it.`;
    const before = new Set(placements.map((p) => p.id));
    const result = await save({ kind: "add", productId: product.id, fields });
    if (!result.saved) return result.message ?? "Couldn't add it. Try again.";
    const placed = result.draft.placements.find((p) => !before.has(p.id) && p.productId === product.id);
    if (placed) {
      added.current = placed.id;
      select(placed.id);
      if (!scope.isSet && placed.faceId !== face.faceId) showFace(placed.faceId);
      builder.say(`Added ${product.name} at ${spotWords(scope.faces, placed)}`);
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

  return { gridBuilder, remove, moveToFace, addProduct, focusAdded, edit: (p: PlacementView, fields: PlacementFields) => change(p, fields, "Changed") };
}
