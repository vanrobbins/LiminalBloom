// Desktop extra (spec §7): drag a type onto the map, or click to add it in view.

"use client";

import { InfoPopover } from "@/components/ui/info-popover";
import type { Focus } from "@/lib/layout/hit-test";
import type { AddKind } from "@/lib/layout/session-core";

import { TILE_TYPE, addOptions } from "./add-options";

export function TypeTiles({ focus, onAdd }: { focus: Focus; onAdd: (kind: AddKind) => void }) {
  return (
    <section aria-label="Add to the map" className="flex flex-col gap-2 border-t border-line-subtle p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-muted">Add</h2>
        <InfoPopover term="frameRack" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {addOptions(focus).map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData(TILE_TYPE, kind)}
            onClick={() => onAdd(kind)}
            className="min-h-11 rounded border border-line bg-raised px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-ink"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
