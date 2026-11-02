// Quick Adjust on a phone: what the sellout affects, the original and the
// adjusted display stacked, and suggestions that fit.

import { X } from "lucide-react";

import { Marker } from "../marker";
import { MockGrid } from "../mock/mock-grid";
import { MockScreen } from "../mock/mock-screen";

const BASE = [
  { label: "Relaxed", col: 0, row: 0, w: 3, h: 1, tone: 2 },
  { label: "Skinny", col: 7, row: 0, w: 3, h: 1, tone: 1 },
];

export function QuickAdjustScreen() {
  return (
    <MockScreen title="Quick Adjust" tab="planograms">
      <span className="flex items-center gap-2 rounded-lg border border-line bg-raised p-2.5 text-xs text-ink">
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 font-medium text-danger">
          <X aria-hidden="true" strokeWidth={1.75} className="size-3" />
          Sold out
        </span>
        <span className="flex-1">Straight jean · 3 displays</span>
        <Marker n={1} />
      </span>
      <span className="flex items-center justify-between text-xs font-medium text-ink">
        Denim wall · Bottom shelf <Marker n={2} />
      </span>
      <span className="text-[0.625rem] text-ink-muted">Original</span>
      <MockGrid cols={10} rows={1} rowHeight="2.25rem" tiles={[...BASE, { label: "Sold out: Straight", col: 3, row: 0, w: 4, h: 1, tone: 0, look: "gap" }]} />
      <span className="text-[0.625rem] text-ink-muted">Adjusted</span>
      <MockGrid cols={10} rows={1} rowHeight="2.25rem" tiles={[...BASE, { label: "Wide-leg", col: 3, row: 0, w: 4, h: 1, tone: 4, look: "new" }]} />
      <section className="rounded-lg border border-line bg-raised p-2.5">
        <span className="mb-1.5 flex items-center justify-between text-sm font-semibold text-ink">
          Fits the space <Marker n={3} />
        </span>
        <span className="flex flex-col gap-1 text-xs">
          <span className="flex justify-between rounded bg-brand px-2 py-1.5 font-medium text-on-brand">
            Wide-leg jean · Indigo <span>2 ft</span>
          </span>
          <span className="flex justify-between px-2 py-1.5 text-ink">
            Relaxed jean · Mid wash <span className="text-ink-muted">1½ ft</span>
          </span>
        </span>
      </section>
      <span className="mt-auto flex items-center gap-2">
        <span className="flex h-11 flex-1 items-center justify-center rounded bg-brand text-sm font-medium text-on-brand">
          Submit for review
        </span>
        <Marker n={4} />
      </span>
    </MockScreen>
  );
}
