// What Planogram Detail does to a placement (Part 2 spec §4): the grid's
// builder (check, drop, arrow keys, trash, pencil), Remove, Move to face and Add product.
// The screen holds the state; this is its wiring, with no JSX.

"use client";

import { useLayoutEffect, useRef } from "react";

import type { Verb } from "@/lib/planograms/builder/fields";
import { keyTarget } from "@/lib/planograms/builder/keys";
import { placeNew } from "@/lib/planograms/builder/place";
import { reorderTarget } from "@/lib/planograms/layers";
import { checkPlacement, type Neighbour } from "@/lib/planograms/rules";
import { spotOf, type GridLayout } from "@/lib/planograms/set-grid";
import { type PlacementFields, type PlacementView, type PlanogramFace, type PlanogramScope, type ProductFit } from "@/lib/planograms/types";
import { shortSpot } from "@/lib/products/location-words";
import { toast } from "@/lib/toast";

import type { GridItem } from "./grid-items";
import type { GridBuilder } from "./planogram-grid";
import type { useBuilder } from "./use-builder";
import { usePanelEdits } from "./use-panel-edits";

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
  /** The selected id, kept even once its placement is gone. */
  selectedId: string | null;
  builder: ReturnType<typeof useBuilder>;
  setSelectedId: (id: string | null) => void;
  /** Selects and keeps the open panel on the selection; null also closes it. */
  select: (id: string | null) => void;
  showFace: (faceId: string) => void;
  /** Opens the product panel on its numbers, with focus in the form. */
  editNumbers: (id: string) => void;
};

export function usePlacementActions({ scope, face, layout, placements, items, isEditing, canMove, selectedId, builder, setSelectedId, select, showFace, editNumbers }: Options) {
  // The tile an Add just placed: focus goes to it when the dialog closes.
  const added = useRef<string | null>(null);
  // What is selected now, for a removal that lands after the person has moved on.
  const current = useRef(selectedId);
  // A layout effect, so it is current before any later task (a save landing) can read it.
  useLayoutEffect(() => {
    current.current = selectedId;
  });

  function check(item: GridItem, fields: PlacementFields): string | null {
    // In the draft, its rows; on the published version, its tiles.
    const others = isEditing ? placements : items;
    // Folded product moved onto a frame rack hangs there (the server sets its hung width; frame racks spec §3).
    const rail = scope.faces.find((f) => f.faceId === fields.faceId)?.fixtureType === "frame_rack";
    const checked = rail && fields.presentation === "folded" ? { ...fields, presentation: "hung" as const, row: 0, rowSpan: 1 } : fields;
    return checkPlacement({ ...checked, id: item.id }, others, scope.faces)?.message ?? null;
  }

  async function change(item: GridItem, fields: PlacementFields, verb: Verb, onFound?: (id: string) => void): Promise<string | null> {
    // The first change on Published starts a draft, and the tile comes back under a new id:
    // keep it selected straight away, and focused if it was (the old tile unmounts).
    const hadFocus = document.activeElement?.closest("[data-placement]")?.getAttribute("data-placement") === item.id;
    let renamed: string | null = null;
    const result = await builder.commit(item, fields, verb, (id) => {
      if (id !== item.id) {
        renamed = id;
        setSelectedId(id);
      }
      onFound?.(id);
    });
    const refocus = renamed;
    // Only while focus was lost with the old tile: focus moved elsewhere since stays there (B10).
    const lost = () => document.activeElement === null || document.activeElement === document.body;
    if (hadFocus && refocus) requestAnimationFrame(() => (lost() ? document.querySelector<HTMLElement>(`[data-placement="${CSS.escape(refocus)}"]`)?.focus() : undefined));
    if (!result.ok) return result.message;
    setSelectedId(result.id);
    if (!scope.isSet && fields.faceId !== face.faceId) showFace(fields.faceId);
    return null;
  }

  /** Move forward / Move back: swaps with the nearest product it overlaps, one save and one undo step. */
  function reorder(item: GridItem, direction: "forward" | "back") {
    const at = reorderTarget(item, isEditing ? placements : items, direction);
    if (at === null) return builder.say(direction === "forward" ? "Already at the front" : "Already at the back");
    void change(item, { ...item, depth: at }, direction === "forward" ? "Moved forward" : "Moved back");
  }

  const gridBuilder: GridBuilder | undefined = canMove
    ? {
        canMove: true,
        check,
        onCommit: (item, fields, verb, onFound) => change(item, fields, verb, onFound),
        onRefused: (message) => toast({ tone: "error", title: message }),
        // The grid holds the nudge where it lands, so a press while it saves starts from there (DECISIONS 11-09).
        onKey: (item, key, shift) => {
          const next = keyTarget(layout, item, key, shift);
          if (!next) return null;
          const reason = check(item, next);
          if (reason) {
            builder.say(reason);
            return null;
          }
          return { fields: next, verb: shift ? "Resized" : "Moved" };
        },
        onReorder: reorder,
        onEmpty: () => select(null),
        onDragging: builder.setDragging,
        // The corner discs: only on a draft's tiles, which have rows to remove and edit.
        ...(isEditing ? { onRemove: trash, onEdit: (item: GridItem) => editNumbers(item.id) } : {}),
      }
    : undefined;

  /** After a removal settles. The control pressed goes with the selection: focus the tile if it's still there (refused),
   * else the grid, else the page's main area, never the page top (B8). */
  function settled(id: string, saved: boolean) {
    requestAnimationFrame(() =>
      (
        (saved ? null : document.querySelector<HTMLElement>(`[data-placement="${CSS.escape(id)}"]`)) ??
        document.querySelector<HTMLElement>("[data-planogram-grid]") ??
        document.getElementById("content")
      )?.focus(),
    );
  }

  /** The panel's Remove: deselects at once. */
  function remove(p: PlacementView) {
    select(null);
    void builder.remove(p).then((result) => settled(p.id, result.saved));
  }

  /** The trash disc and Delete: the grid fades the tile first; a refusal leaves it selected, with the status line saying why. */
  async function trash(item: GridItem): Promise<boolean> {
    const p = placements.find((o) => o.id === item.id);
    if (!p) return false;
    const { saved } = await builder.remove(p);
    // The fade and the save take a moment: if another tile was picked meanwhile, its selection and focus stay.
    // With nothing selected (Escape during the fade), focus still settles, so it doesn't drop to the page.
    if (current.current === p.id || current.current === null) {
      if (saved) select(null);
      settled(p.id, saved);
    }
    return saved;
  }

  const { edit, moveToFace } = usePanelEdits({ scope, placements, builder, change });

  async function addProduct(product: ProductFit): Promise<string | null> {
    // Nowhere to go: say so before a draft is started for it. With no draft the add starts one, and the spot is
    // picked again among that draft's placements, which may differ from the tiles shown.
    const faces = [face, ...scope.faces.filter((f) => f.faceId !== face.faceId)];
    const pick = (others: readonly Neighbour[]) => placeNew(faces, others, product) ?? `No open spot fits ${product.name}. Make room, then add it.`;
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

  return { gridBuilder, reorder, remove, moveToFace, addProduct, focusAdded, edit };
}
