// Zoom buttons for touch screens, where there is no wheel (spec §7).

"use client";

import { Maximize, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ZoomControls({ onZoom, onFit }: { onZoom: (factor: number) => void; onFit: () => void }) {
  return (
    <div className="absolute right-3 bottom-3 flex flex-col gap-2 lg:hidden">
      <Button variant="secondary" icon aria-label="Zoom in" onClick={() => onZoom(1.25)}>
        <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <Button variant="secondary" icon aria-label="Zoom out" onClick={() => onZoom(0.8)}>
        <Minus aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <Button variant="secondary" icon aria-label="Fit to screen" onClick={onFit}>
        <Maximize aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
    </div>
  );
}
