// While drawing a custom outline: what to do, and the way out (spec §10).

"use client";

import { Button } from "@/components/ui/button";

export function DrawingBar({ corners, onUndo, onCancel }: { corners: number; onUndo: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-raised p-3 shadow-lg">
      <p className="min-w-0 flex-1 text-sm text-ink">Tap to place each corner. Tap the first corner to finish.</p>
      <Button variant="secondary" disabled={corners === 0} onClick={onUndo}>
        Undo corner
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
