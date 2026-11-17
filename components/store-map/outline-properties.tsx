// The store's walls: their size, and removing a selected corner.

"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatLength } from "@/lib/layout/format";
import { bounds } from "@/lib/layout/geometry";
import type { SessionAction } from "@/lib/layout/session";
import type { Outline } from "@/lib/layout/types";

type OutlinePropertiesProps = { outline: Outline; cornerSelected: boolean; dispatch: (action: SessionAction) => void };

export function OutlineProperties({ outline, cornerSelected, dispatch }: OutlinePropertiesProps) {
  const box = bounds(outline.points);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">Store outline</h2>
      <p className="text-sm text-ink-muted">
        {formatLength(box.maxX - box.minX)} × {formatLength(box.maxY - box.minY)} · {outline.points.length} corners
      </p>
      {cornerSelected ? (
        <Button icon variant="secondary" onClick={() => dispatch({ type: "delete" })} aria-label="Remove corner">
          <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      ) : (
        <p className="text-sm text-ink-muted">Drag a corner to reshape, or tap + on a wall to add a corner.</p>
      )}
    </div>
  );
}
