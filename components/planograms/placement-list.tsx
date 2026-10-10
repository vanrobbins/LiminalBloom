// The folded-stack table of §3.3, beside or below the grid. Also the keyboard
// and screen-reader route to every placement, including draft ones whose face
// left the set ("No longer in this set"), so they can be opened and removed.

"use client";

import { AlertTriangle } from "lucide-react";

import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import { spanLabel } from "@/lib/products/location-label";
import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";

type PlacementListProps = {
  faces: readonly PlanogramFace[];
  items: readonly GridItem[];
  /** Draft placements on a face no longer in the scope. */
  orphans?: readonly GridItem[];
  issues?: ReadonlyMap<string, string>;
  highlightProductId?: string | null;
  onSelect?: (id: string) => void;
};

export function PlacementList({ faces, items, orphans = [], issues, highlightProductId, onSelect }: PlacementListProps) {
  const groups = faces.map((face) => ({ key: face.faceId, caption: faces.length > 1 ? face.label : "Placements", rows: items.filter((i) => i.faceId === face.faceId) }));
  if (orphans.length > 0) groups.push({ key: "orphans", caption: "No longer in this set", rows: [...orphans] });
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ key, caption, rows: onFace }) => {
        return (
          <table key={key} className="w-full text-left text-sm">
            <caption className="mb-1 text-left font-medium text-ink">{caption}</caption>
            <thead className="text-ink-muted">
              <tr>
                <th scope="col" className="py-1 font-normal">Product</th>
                <th scope="col" className="py-1 font-normal">Cells</th>
                <th scope="col" className="py-1 font-normal">How</th>
                <th scope="col" className="py-1 text-right font-normal">Pieces</th>
              </tr>
            </thead>
            <tbody>
              {onFace.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-ink-muted">Nothing here yet.</td>
                </tr>
              ) : (
                onFace.map((item) => {
                  const issue = issues?.get(item.id);
                  return (
                    <tr key={item.id} data-highlighted={item.productId === highlightProductId ? "" : undefined} className="border-t border-line-subtle data-highlighted:font-semibold">
                      <td className="py-2 pr-2 text-ink">
                        {onSelect ? (
                          <button type="button" onClick={() => onSelect(item.id)} className="min-h-11 text-left underline underline-offset-4" aria-label={`Edit ${item.productName}`}>
                            {item.productName}
                          </button>
                        ) : (
                          item.productName
                        )}
                        {issue ? (
                          <span className="mt-1 flex items-center gap-1 text-danger">
                            <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" />
                            {issue}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 font-mono text-ink">{spanLabel(item)}</td>
                      <td className="py-2 pr-2 text-ink-muted">{PRESENTATION_LABEL[item.presentation]}</td>
                      <td className="py-2 text-right font-mono text-ink">{item.pieceCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
