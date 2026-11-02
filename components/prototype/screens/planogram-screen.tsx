// Planogram detail with the builder: faces, the half-foot grid, a selected
// tile with handles, the Undo toast and the sticky draft bar.

import { Calendar, Check } from "lucide-react";

import { Marker } from "../marker";
import { MockGrid } from "../mock/mock-grid";
import { MockScreen } from "../mock/mock-screen";

export function PlanogramScreen() {
  return (
    <MockScreen title="Fitting room rack" tab="planograms">
      <span className="flex items-center gap-2">
        <span className="inline-flex rounded-lg border border-line p-0.5 text-xs">
          <span className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 font-semibold text-on-brand">
            <Check aria-hidden="true" strokeWidth={2} className="size-3" />
            Front
          </span>
          <span className="px-3 py-1.5 text-ink-muted">Back</span>
        </span>
        <Marker n={1} />
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-line-subtle px-2 py-0.5 text-xs text-ink">
          <Calendar aria-hidden="true" strokeWidth={1.75} className="size-3" />
          Due Nov 14
        </span>
      </span>
      <span className="flex justify-between font-mono text-[0.625rem] text-ink-muted">
        <span>0</span><span>1½</span><span>3</span><span>4½</span><span>6 ft</span>
      </span>
      <div className="relative">
        <MockGrid
          cols={12}
          rows={5}
          tiles={[
            { label: "Linen tee", col: 0, row: 0, w: 3, h: 2, tone: 4 },
            { label: "Sweater", col: 3, row: 0, w: 3, h: 2, tone: 3, look: "selected" },
            { label: "Dress", col: 7, row: 0, w: 2, h: 3, tone: 5 },
            { label: "Jacket", col: 9, row: 0, w: 3, h: 3, tone: 2 },
            { label: "Pant", col: 0, row: 3, w: 4, h: 2, tone: 1 },
            { label: "Bag", col: 5, row: 3, w: 2, h: 2, tone: 6 },
          ]}
        />
        <span className="absolute top-[-0.6rem] left-[-0.4rem]"><Marker n={2} /></span>
        <span className="absolute top-[28%] left-[44%]"><Marker n={3} /></span>
        <span aria-hidden="true" className="absolute top-[37%] left-[48%] size-2.5 rounded-full border-2 border-brand bg-raised" />
      </div>
      <p className="text-xs text-ink-muted">Sweater selected. Drag to move, pull the dot to resize.</p>
      <span className="flex items-center gap-2">
        <span className="flex flex-1 items-center justify-between rounded-lg bg-ink px-3 py-2 text-xs text-surface">
          Moved Sweater
          <span className="font-semibold underline underline-offset-4">Undo</span>
        </span>
        <Marker n={4} />
      </span>
      <div className="-mx-4 -mb-3 mt-auto flex items-center gap-2 border-t border-line bg-raised px-4 py-2.5">
        <span className="flex-1 text-xs text-ink-muted">Draft · 3 changes</span>
        <Marker n={5} />
        <span className="flex h-10 items-center rounded bg-brand px-4 text-sm font-medium text-on-brand">Publish</span>
      </div>
    </MockScreen>
  );
}
