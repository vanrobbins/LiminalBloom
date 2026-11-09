// A published planogram, read-only, where it's shown outside Planogram Detail
// (the map's fixture panel, spec §5): face switcher, grid, product sheet.

"use client";

import { useState } from "react";

import { combinedBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramScope, ProductLook, SnapshotEntry } from "@/lib/planograms/types";

import { FaceSwitcher } from "./face-switcher";
import { itemsFromSnapshot, startFace } from "./grid-items";
import { LayerList } from "./layer-list";
import { PlanogramGrid } from "./planogram-grid";
import { ProductSheet } from "./product-sheet";

type PlanogramPreviewProps = { scope: PlanogramScope; entries: readonly SnapshotEntry[]; looks: Readonly<Record<string, ProductLook>> };

export function PlanogramPreview({ scope, entries, looks }: PlanogramPreviewProps) {
  const [faceId, setFaceId] = useState(() => startFace(scope, entries, null, null));
  const [sheetId, setSheetId] = useState<string | null>(null);
  const face = scope.faces.find((f) => f.faceId === faceId) ?? scope.faces[0];
  const shown = scope.isSet ? scope.faces : [face];
  const items = itemsFromSnapshot(entries, looks);
  const open = items.find((i) => i.id === sheetId) ?? null;
  return (
    <div className="flex flex-col gap-3">
      {scope.isSet ? null : <FaceSwitcher faces={scope.faces} value={face.faceId} onChange={setFaceId} />}
      <PlanogramGrid
        layout={scope.isSet ? combinedBlocks(scope) : singleBlock(face)}
        items={items.filter((i) => shown.some((f) => f.faceId === i.faceId))}
        label={`${scope.fixtureName}, ${scope.isRun ? "run" : scope.isSet ? "table set" : face.label}`}
        selectedId={sheetId}
        onSelect={setSheetId}
      />
      <ProductSheet
        open={sheetId !== null}
        item={open}
        face={scope.faces.find((f) => f.faceId === open?.faceId) ?? null}
        onClose={() => setSheetId(null)}
      >
        {/* A product hung behind another is reached here (hung layers). */}
        {open ? <LayerList item={open} items={items} onPick={setSheetId} /> : null}
      </ProductSheet>
    </div>
  );
}
