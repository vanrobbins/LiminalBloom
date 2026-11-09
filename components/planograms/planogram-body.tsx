// The face switcher, grid, product cards and the product sheet. Its own
// component, not nested in the screen: a nested one remounts on every render
// and drops focus and typed values. The screen decides what a tap does and
// holds the builder; this lays it out.

"use client";

import type { GridLayout } from "@/lib/planograms/set-grid";
import type { PlacementFields, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

import { FaceSwitcher } from "./face-switcher";
import type { GridItem } from "./grid-items";
import { PlacementList } from "./placement-list";
import { PlacementEditor } from "./placement-panel";
import { PlanogramGrid, type GridBuilder } from "./planogram-grid";
import { ProductSheet } from "./product-sheet";
import type { Edges } from "./use-scroll-edges";

export type SheetMode = "details" | "edit";

type PlanogramBodyProps = {
  scope: PlanogramScope;
  face: PlanogramFace;
  shownFaces: readonly PlanogramFace[];
  layout: GridLayout;
  items: readonly GridItem[];
  issues: ReadonlyMap<string, string>;
  isEditing: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  sheetId: string | null;
  sheetMode: SheetMode;
  openSheet: (id: string | null, mode?: SheetMode) => void;
  highlightProductId: string | null;
  placements: readonly PlacementView[];
  busy: boolean;
  /** Which side a newly shown face slides in from; null on first paint. */
  slideFrom: "left" | "right" | null;
  builder?: GridBuilder;
  onTile: (id: string) => void;
  onSwipe?: (gesture: { dx: number; dy: number; edges: Edges }) => void;
  onFace: (faceId: string) => void;
  /** "Edit numbers": resolves to the refusal to show in the form, or null. */
  onEdit: (placement: PlacementView, fields: PlacementFields) => Promise<string | null>;
  onRemove: (placement: PlacementView) => void;
};

export function PlanogramBody({
  scope,
  face,
  shownFaces,
  layout,
  items,
  issues,
  isEditing,
  selectedId,
  setSelectedId,
  sheetId,
  sheetMode,
  openSheet,
  highlightProductId,
  placements,
  busy,
  slideFrom,
  builder,
  onTile,
  onSwipe,
  onFace,
  onEdit,
  onRemove,
}: PlanogramBodyProps) {
  const orphans = isEditing ? items.filter((i) => !scope.faces.some((f) => f.faceId === i.faceId)) : [];

  // A card marks its tile and brings it into view; an orphan has no tile, so its card opens the sheet to remove it.
  function fromCard(id: string) {
    setSelectedId(id);
    if (orphans.some((o) => o.id === id)) return openSheet(id, "edit");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document.querySelector(`[data-placement="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" }),
    );
  }

  const sheetItem = sheetId ? (items.find((i) => i.id === sheetId) ?? null) : null;
  const sheetPlacement = sheetId ? (placements.find((p) => p.id === sheetId) ?? null) : null;

  return (
    <>
      {scope.isSet ? null : <FaceSwitcher faces={scope.faces} value={face.faceId} onChange={onFace} />}
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PlanogramGrid
          layout={layout}
          items={items.filter((i) => shownFaces.some((f) => f.faceId === i.faceId))}
          label={`${scope.fixtureName}, ${scope.isRun ? "run" : scope.isSet ? "table set" : face.label}`}
          selectedId={selectedId}
          highlightProductId={highlightProductId}
          issues={issues}
          onSelect={onTile}
          slideFrom={slideFrom}
          onSwipe={onSwipe}
          builder={builder}
        />
        <div className="flex flex-col gap-4">
          <ProductSheet open={sheetId !== null} item={sheetItem} face={scope.faces.find((f) => f.faceId === sheetItem?.faceId) ?? null} onClose={() => (sheetMode === "edit" ? setSelectedId(null) : openSheet(null))}>
            {isEditing && sheetId !== null && sheetMode === "edit" ? (
              <div data-placement-editor>
                <PlacementEditor
                  placement={sheetPlacement}
                  isGone={sheetPlacement === null}
                  faces={scope.faces}
                  others={placements}
                  busy={busy}
                  // Done with this tile: a phone's selection bar hides Publish until it's cleared.
                  onClose={() => setSelectedId(null)}
                  onSave={onEdit}
                  onRemove={onRemove}
                />
              </div>
            ) : null}
          </ProductSheet>
          <PlacementList faces={shownFaces} items={items} orphans={orphans} issues={issues} highlightProductId={highlightProductId} selectedId={selectedId} onSelect={fromCard} />
        </div>
      </div>
    </>
  );
}
