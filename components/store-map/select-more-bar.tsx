// Shown while "Select more" is on: taps add to the selection until Done.

"use client";

import { Button } from "@/components/ui/button";
import type { SessionAction } from "@/lib/layout/session";

export function SelectMoreBar({ count, dispatch }: { count: number; dispatch: (action: SessionAction) => void }) {
  return (
    <div role="status" className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line-subtle bg-raised py-1 pr-1 pl-3 shadow-lg">
      <span className="text-sm whitespace-nowrap text-ink">Select more · {count} selected</span>
      <Button variant="secondary" onClick={() => dispatch({ type: "selectMore", on: false })}>
        Done
      </Button>
    </div>
  );
}
