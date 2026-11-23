// What a PlanogramGrid takes (planogram-grid.tsx).

import type { GridLayout } from "@/lib/planograms/set-grid";

import type { GridBuilder } from "./grid-builder";
import type { GridItem } from "./grid-items";
import type { Edges } from "./use-scroll-edges";

export type PlanogramGridProps = {
  layout: GridLayout;
  items: readonly GridItem[];
  label: string;
  selectedId?: string | null;
  highlightProductId?: string | null;
  issues?: ReadonlyMap<string, string>;
  onSelect: (id: string) => void;
  slideFrom?: "left" | "right" | null;
  onSwipe?: (gesture: { dx: number; dy: number; edges: Edges }) => void;
  builder?: GridBuilder;
  /** A draft is being edited: the guides show (they also show whenever `builder.canMove`). */
  editing?: boolean;
  fit?: boolean; // scaled to the width however narrow (Compare in a phone's sheet), not 20 px a unit at least
  /** Only to look at (Compare): tiles are named images, not buttons, so nothing in it takes focus or a press. */
  readOnly?: boolean;
};
