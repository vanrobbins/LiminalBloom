// The location sheet over the Products list: status, mini map, words and
// the fixture's face with the product outlined.

import { Check } from "lucide-react";

import { Marker } from "../marker";
import { MockGrid } from "../mock/mock-grid";
import { MockScreen } from "../mock/mock-screen";

export function LocatorScreen() {
  return (
    <MockScreen title="Products" tab="products">
      <div className="-mx-4 -mb-3 flex flex-1 flex-col gap-2.5 rounded-t-2xl border-t border-line bg-raised px-4 pt-2 pb-3 *:shrink-0">
        <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-line" />
        <span className="text-base font-semibold text-ink">
          High-Rise Pant <span className="font-mono text-xs font-normal text-ink-muted">HRP-01</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="grid flex-1 grid-cols-3 rounded-lg border border-line p-0.5 text-center text-xs">
            <span className="flex items-center justify-center gap-1 rounded-md bg-brand py-1.5 font-semibold text-on-brand">
              <Check aria-hidden="true" strokeWidth={2} className="size-3" />
              In stock
            </span>
            <span className="py-1.5 text-ink-muted">Sold out</span>
            <span className="py-1.5 text-ink-muted">On sale</span>
          </span>
          <Marker n={1} />
        </span>
        <span className="flex items-start gap-2">
          <svg viewBox="0 0 120 60" aria-hidden="true" className="w-28 shrink-0 rounded border border-line">
            <rect x="0" y="0" width="120" height="60" className="fill-surface" />
            <rect x="4" y="4" width="50" height="26" className="fill-zone-1" />
            <rect x="64" y="4" width="52" height="52" className="fill-zone-2" />
            <rect x="100" y="10" width="8" height="40" className="fill-brand stroke-ink" />
          </svg>
          <Marker n={2} />
          <span className="flex flex-col gap-0.5 text-xs">
            <span className="font-medium text-ink">Denim wall · Middle shelf</span>
            <span className="text-ink-muted">2–3 ft from left · Folded</span>
            <Marker n={3} />
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex-1">
            <MockGrid
              cols={12}
              rows={3}
              rowHeight="1.4rem"
              tiles={[
                { label: "Tee", col: 0, row: 0, w: 3, h: 1, tone: 3 },
                { label: "Pant", col: 4, row: 1, w: 2, h: 1, tone: 2, look: "found" },
                { label: "Jean", col: 6, row: 1, w: 3, h: 1, tone: 5 },
                { label: "Short", col: 0, row: 2, w: 4, h: 1, tone: 6 },
              ]}
            />
          </span>
          <Marker n={4} />
        </span>
        <span className="mt-auto flex items-center gap-2">
          <span className="flex h-11 flex-1 items-center justify-center rounded border border-line bg-raised text-sm text-ink">
            Open planogram
          </span>
          <Marker n={5} />
        </span>
      </div>
    </MockScreen>
  );
}
