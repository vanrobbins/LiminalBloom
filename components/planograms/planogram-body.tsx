// The face switcher, grid, placement list and (while editing) the placement
// panel. Its own component, not nested in the screen: a nested one remounts on
// every render and drops focus and typed values.

"use client";

import type { GridLayout } from "@/lib/planograms/set-grid";
import type { Change, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

import { FaceSwitcher } from "./face-switcher";
import type { GridItem } from "./grid-items";
import { PlacementList } from "./placement-list";
import { PlacementPanel } from "./placement-panel";
import { PlanogramGrid } from "./planogram-grid";
import { refusalOf, type SaveResult } from "./use-planogram-draft";

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
  highlightProductId: string | null;
  placements: readonly PlacementView[];
  selected: PlacementView | null;
  busy: boolean;
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
  highlightProductId,
  placements,
  selected,
  busy,
  onFace,
  onAdd,
  save,
}: PlanogramBodyProps) {
  const orphans = isEditing ? items.filter((i) => !scope.faces.some((f) => f.faceId === i.faceId)) : [];
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
          onSelect={isEditing ? setSelectedId : undefined}
          onEmptyCell={isEditing ? onAdd : undefined}
        />
        <div className="flex flex-col gap-4">
          <PlacementList faces={shownFaces} items={items} orphans={orphans} issues={issues} highlightProductId={highlightProductId} onSelect={isEditing ? setSelectedId : undefined} />
          {isEditing ? (
            <PlacementPanel
              open={selectedId !== null}
              placement={selected}
              isGone={selectedId !== null && selected === null}
              faces={scope.faces}
              others={placements}
              busy={busy}
              onClose={() => setSelectedId(null)}
              onSave={async (p, fields) => refusalOf(await save({ kind: "update", id: p.id, version: p.version, fields }))}
              onRemove={(p) => {
                setSelectedId(null);
                void save({ kind: "remove", id: p.id, version: p.version });
              }}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
