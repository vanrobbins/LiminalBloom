// First visit: Rectangle (width × depth) or Custom (draw it corner by corner).
// DECISIONS 2026-09-30: no L-shape preset.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FeetInchesInput, readFeetInches } from "@/components/ui/feet-inches-input";
import { MAX_STORE_SIDE, MIN_STORE_SIDE } from "@/lib/layout/limits";
import type { SessionAction } from "@/lib/layout/session";

const inRange = (inches: number | null): inches is number => inches !== null && inches >= MIN_STORE_SIDE && inches <= MAX_STORE_SIDE;

export function OutlineSetup({ dispatch }: { dispatch: (action: SessionAction) => void }) {
  const router = useRouter();
  const [width, setWidth] = useState(480);
  const [depth, setDepth] = useState(360);

  // Reads what is typed now, not only what was committed: iOS may not blur a field when a button is tapped.
  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const w = readFeetInches(data, "width");
    const d = readFeetInches(data, "depth");
    // A typo shows its own error under the field; nothing is created from it.
    if (inRange(w) && inRange(d)) dispatch({ type: "setRectangle", width: w, depth: d });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // There is nothing to edit without an outline: closing leaves the editor.
        if (!open) router.push("/layout");
      }}
      title="Set up your store"
      description="Start with the shape of the sales floor. You can reshape it any time."
    >
      <form className="flex flex-col gap-3" onSubmit={create}>
        <h3 className="font-medium text-ink">Rectangle</h3>
        <FeetInchesInput label="Width" name="width" value={width} min={MIN_STORE_SIDE} max={MAX_STORE_SIDE} onCommit={setWidth} />
        <FeetInchesInput label="Depth" name="depth" value={depth} min={MIN_STORE_SIDE} max={MAX_STORE_SIDE} onCommit={setDepth} />
        <Button type="submit">Create outline</Button>
      </form>
      <section className="flex flex-col gap-2 border-t border-line-subtle pt-4">
        <h3 className="font-medium text-ink">Custom</h3>
        <p className="text-sm text-ink-muted">For any other shape: tap each corner on the map.</p>
        <Button variant="secondary" onClick={() => dispatch({ type: "startDrawing" })}>
          Draw it corner by corner
        </Button>
      </section>
    </Dialog>
  );
}
