// One side of Compare (0.7.0.9 spec §5.3): a read-only drawing of the floor, as a figure with its caption. A fixture's
// faces each get a grid (a table set is one combined view); only faces with changes are drawn, else the first. The grid
// is scaled to the width it is given, so a phone's sheet never scrolls sideways inside. Changed tiles are outlined.

"use client";

import type { GridItem } from "@/components/planograms/grid-items";
import { PlanogramGrid } from "@/components/planograms/planogram-grid";
import { combinedBlocks, singleBlock, type GridLayout } from "@/lib/planograms/set-grid";
import type { PlanogramScope } from "@/lib/planograms/types";

type Drawn = { key: string; layout: GridLayout; label: string };

/** The grids Compare draws: the faces that change (a set draws as one). */
export function drawnFaces(scope: PlanogramScope, changedFaceIds: readonly string[]): Drawn[] {
  if (scope.isSet) return [{ key: "set", layout: combinedBlocks(scope), label: scope.fixtureName }];
  const changed = scope.faces.filter((f) => changedFaceIds.includes(f.faceId));
  return (changed.length > 0 ? changed : scope.faces.slice(0, 1)).map((f) => ({ key: f.faceId, layout: singleBlock(f), label: `${scope.fixtureName}, ${f.label}` }));
}

const noop = () => {};

export function CompareFigure({ caption, faces, items }: { caption: string; faces: readonly Drawn[]; items: readonly GridItem[] }) {
  return (
    <figure data-compare-figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-sm font-semibold text-ink">{caption}</figcaption>
      {faces.map((f) => (
        <PlanogramGrid key={f.key} fit layout={f.layout} items={items} label={`${caption}, ${f.label}`} onSelect={noop} />
      ))}
    </figure>
  );
}
