// What a planogram grid lets its selected tile do (planogram-grid.tsx): move and resize it, nudge it by
// key, remove it and open its panel. Built by use-placement-actions.ts.

import type { PlacementFields } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";

export type GridBuilder = {
  /** The selected tile may be dragged, resized and moved with the arrow keys. */
  canMove: boolean;
  /** Why a tile can't go there (rules.ts words), or null. */
  check: (item: GridItem, fields: PlacementFields) => string | null;
  /** Saves a drop; the tile stays where it landed until this settles. `onFound` names the tile it was saved to (a started draft renames it). */
  onCommit: (item: GridItem, fields: PlacementFields, verb: "Moved" | "Resized", onFound: (id: string) => void) => Promise<unknown>;
  /** An invalid drop: it has already snapped back; say why. */
  onRefused: (message: string) => void;
  /** An arrow key on the selected tile: where it goes, or null (it can't; the builder has said why). Held and saved like a drop. */
  onKey: (item: GridItem, key: string, shift: boolean) => { fields: PlacementFields; verb: "Moved" | "Resized" } | null;
  /** Alt+Up / Alt+Down on the selected tile: Move forward / Move back on a shared rail. */
  onReorder: (item: GridItem, direction: "forward" | "back") => void;
  /** Tap on empty space, or Escape on the selected tile. */
  onEmpty: () => void;
  onDragging: (isDragging: boolean) => void;
  /** Trash on the selected tile: resolves true once it's gone, false if refused (the tile comes back). With onEdit, shows the corner discs. */
  onRemove?: (item: GridItem) => Promise<boolean>;
  /** Pencil, or another tap on the selected tile: opens its panel. */
  onEdit?: (item: GridItem) => void;
};
