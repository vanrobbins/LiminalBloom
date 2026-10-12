// The face switcher, grid, product cards and the product sheet (which holds
// the placement editor while editing). Its own component, not nested in the screen: a nested one remounts on
// every render and drops focus and typed values.

"use client";

import type { GridLayout } from "@/lib/planograms/set-grid";
import type { Change, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

import { FaceSwitcher } from "./face-switcher";
import type { GridItem } from "./grid-items";
import { PlacementList } from "./placement-list";
import { PlacementEditor } from "./placement-panel";
import { PlanogramGrid } from "./planogram-grid";
import { ProductSheet } from "./product-sheet";
import { refusalOf, type SaveResult } from "./use-planogram-draft";
import type { Edges } from "./use-scroll-edges";

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
  setSheetId: (id: string | null) => void;
  highlightProductId: string | null;
  placements: readonly PlacementView[];
  selected: PlacementView | null;
  busy: boolean;
  /** Which side a newly shown face slides in from; null on first paint. */
  slideFrom: "left" | "right" | null;
  onSwipe?: (gesture: { dx: number; dy: number; edges: Edges }) => void;
  onFace: (faceId: string) => void;
  onAdd: (cell: { faceId: string; col: number; row: number }) => void;
  save: (change: Change) => Promise<SaveResult>;
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
  setSheetId,
  highlightProductId,
  placements,
  selected,
  busy,
  slideFrom,
  onSwipe,
  onFace,
  onAdd,
  save,
}: PlanogramBodyProps) {
  const orphans = isEditing ? items.filter((i) => !scope.faces.some((f) => f.faceId === i.faceId)) : [];

  function fromTile(id: string) {
    setSelectedId(id);
    setSheetId(id);
  }

  // A card marks its tile and brings it into view; an orphan has no tile, so its card opens the sheet.
  function fromCard(id: string) {
    setSelectedId(id);
    if (orphans.some((o) => o.id === id)) return setSheetId(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document.querySelector(`[data-placement="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" }),
    );
  }

  const sheetItem = sheetId ? (items.find((i) => i.id === sheetId) ?? null) : null;

  return (
    <>
      {scope.isSet ? null : <FaceSwitcher faces={scope.faces} value={face.faceId} onChange={onFace} />}
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PlanogramGrid
          layout={layout}
          items={items.filter((i) => shownFaces.some((f) => f.faceId === i.faceId))}
          label={`${scope.fixtureName}, ${scope.isSet ? "table set" : face.label}`}
          selectedId={selectedId}
          highlightProductId={highlightProductId}
          issues={issues}
          onSelect={fromTile}
          onEmptyCell={isEditing ? onAdd : undefined}
          slideFrom={slideFrom}
          onSwipe={onSwipe}
        />
        <div className="flex flex-col gap-4">
          <ProductSheet open={sheetId !== null} item={sheetItem} onClose={() => setSheetId(null)}>
            {isEditing && sheetId !== null ? (
              <PlacementEditor
                placement={selected}
                isGone={selected === null}
                faces={scope.faces}
                others={placements}
                busy={busy}
                onClose={() => setSheetId(null)}
                onSave={async (p, fields) => refusalOf(await save({ kind: "update", id: p.id, version: p.version, fields }))}
                onRemove={(p) => {
                  setSheetId(null);
                  setSelectedId(null);
                  // The tile is gone once this lands: leave focus on the grid, not the page top.
                  void save({ kind: "remove", id: p.id, version: p.version }).then((result) => {
                    if (result.saved) requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-planogram-grid]")?.focus());
                  });
                }}
              />
            ) : null}
          </ProductSheet>
          <PlacementList faces={shownFaces} items={items} orphans={orphans} issues={issues} highlightProductId={highlightProductId} selectedId={selectedId} onSelect={fromCard} />
        </div>
      </div>
    </>
  );
}
