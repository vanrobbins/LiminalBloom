// The products on the shown face(s) as cards (spec §4.3), under or beside the
// grid. Also the keyboard and screen-reader route to every placement,
// including draft ones whose face left the set ("No longer in this set").

"use client";

import { AlertTriangle } from "lucide-react";

import { ProductImage } from "@/components/products/product-image";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import { spanLabel } from "@/lib/products/location-label";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";

type PlacementListProps = {
  faces: readonly PlanogramFace[];
  items: readonly GridItem[];
  orphans?: readonly GridItem[];
  issues?: ReadonlyMap<string, string>;
  highlightProductId?: string | null;
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

export function PlacementList({ faces, items, orphans = [], issues, highlightProductId, selectedId, onSelect }: PlacementListProps) {
  const groups = faces.map((face) => ({ key: face.faceId, caption: faces.length > 1 ? face.label : "Products", rows: items.filter((i) => i.faceId === face.faceId) }));
  if (orphans.length > 0) groups.push({ key: "orphans", caption: "No longer in this set", rows: [...orphans] });
  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ key, caption, rows }) => (
        <section key={key} aria-labelledby={`cards-${key}`} className="flex flex-col gap-2">
          <h2 id={`cards-${key}`} className="text-sm font-medium text-ink">
            {caption}
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing here yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
              {rows.map((item) => {
                const issue = issues?.get(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-card={item.id}
                      data-highlighted={item.productId === highlightProductId ? "" : undefined}
                      aria-pressed={item.id === selectedId}
                      onClick={() => onSelect(item.id)}
                      className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-line-subtle bg-raised p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-brand data-highlighted:border-ink motion-safe:transition-shadow motion-safe:duration-(--duration-fast)"
                    >
                      <ProductImage productId={item.productId} name={item.productName} categoryName={item.categoryName} imageKey={item.imageKey} decorative />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate font-medium text-ink">{item.productName}</span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                          <span className="rounded bg-line-subtle px-1.5 font-mono whitespace-nowrap text-ink">{spanLabel(item)}</span>
                          {PRESENTATION_LABEL[item.presentation]} · {item.pieceCount} pcs
                        </span>
                        {issue ? (
                          <span className="flex items-center gap-1 text-sm text-danger">
                            <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
                            {issue}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
