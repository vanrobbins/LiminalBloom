// The Layers list (hung layers spec §4): the products sharing rail space with
// the open one, front to back. A row selects its product, so one hidden behind
// another can still be reached; Move forward / Move back sit on the open one's
// row while the builder may move it. One press is one save and one undo step.

"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { ProductImage } from "@/components/products/product-image";
import { Button } from "@/components/ui/button";
import { layerGroups, reorderTarget } from "@/lib/planograms/layers";

import type { GridItem } from "./grid-items";

type LayerListProps = {
  item: GridItem;
  items: readonly GridItem[];
  onPick: (id: string) => void;
  /** Absent where nothing may move (a past version, a viewer). */
  onReorder?: (item: GridItem, direction: "forward" | "back") => void;
  busy?: boolean;
};

export function LayerList({ item, items, onPick, onReorder, busy = false }: LayerListProps) {
  const group = layerGroups(items).find((g) => g.some((i) => i.id === item.id)) ?? [];
  if (group.length < 2) return null;
  return (
    <section aria-labelledby="layers-heading" data-layer-list className="flex flex-col gap-2">
      <h3 id="layers-heading" className="text-sm font-semibold text-ink">
        Layers, front to back
      </h3>
      <ol className="flex flex-col gap-1">
        {group.map((g) => {
          const isOpen = g.id === item.id;
          return (
            <li key={g.id} data-layer={g.id} className="flex items-center gap-1">
              <button
                type="button"
                aria-current={isOpen ? "true" : undefined}
                onClick={() => onPick(g.id)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-line-subtle bg-raised p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current]:border-ink aria-[current]:ring-2 aria-[current]:ring-brand"
              >
                <ProductImage productId={g.productId} name={g.productName} categoryName={g.categoryName} imageKey={g.imageKey} swatch={g.swatch} texture={g.texture} colorWord={g.colorWord} view="hung" decorative />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{g.productName}</span>
                <span className="shrink-0 pr-1 text-xs text-ink-muted tabular-nums">
                  {g.pieceCount} {g.pieceCount === 1 ? "piece" : "pieces"}
                </span>
              </button>
              {isOpen && onReorder ? (
                <>
                  <Button icon variant="secondary" aria-label="Move forward" disabled={busy || reorderTarget(g, items, "forward") === null} onClick={() => onReorder(g, "forward")}>
                    <ArrowUp aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  </Button>
                  <Button icon variant="secondary" aria-label="Move back" disabled={busy || reorderTarget(g, items, "back") === null} onClick={() => onReorder(g, "back")}>
                    <ArrowDown aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  </Button>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
