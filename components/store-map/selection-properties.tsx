// Several items selected: what can be done to all of them at once.

"use client";

import { Button } from "@/components/ui/button";
import type { SessionAction } from "@/lib/layout/session";

export function SelectionProperties({ count, dispatch }: { count: number; dispatch: (action: SessionAction) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">{count} items selected</h2>
      <p className="text-sm text-ink-muted">Drag any of them to move them together.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => dispatch({ type: "duplicate" })}>
          Duplicate
        </Button>
        <Button variant="danger" onClick={() => dispatch({ type: "delete" })}>
          Delete
        </Button>
      </div>
    </div>
  );
}
