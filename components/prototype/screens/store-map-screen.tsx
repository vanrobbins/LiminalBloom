// The store map: outline, entrance, zones and fixtures, with a fixture's
// panel peeking up from the bottom.

import { Marker } from "../marker";
import { MockGrid } from "../mock/mock-grid";
import { MockScreen } from "../mock/mock-screen";

export function StoreMapScreen() {
  return (
    <MockScreen title="Layout" tab="layout">
      <div className="relative">
        <svg viewBox="0 0 280 260" aria-hidden="true" className="w-full">
          <rect x="4" y="4" width="272" height="252" rx="2" className="fill-raised stroke-ink" strokeWidth="2" />
          <rect x="110" y="250" width="60" height="10" className="fill-surface" />
          <polygon points="12,12 130,12 130,110 12,110" className="fill-zone-1" />
          <polygon points="150,12 268,12 268,150 150,150" className="fill-zone-2" />
          <polygon points="12,130 130,130 130,240 12,240" className="fill-zone-4" />
          <text x="20" y="28" className="fill-ink text-[11px]">Denim</text>
          <text x="158" y="28" className="fill-ink text-[11px]">Knits</text>
          <text x="20" y="146" className="fill-ink text-[11px]">Front tables</text>
          <rect x="24" y="40" width="94" height="14" className="fill-surface stroke-ink" />
          <rect x="24" y="76" width="94" height="14" className="fill-surface stroke-ink" />
          <rect x="166" y="44" width="16" height="90" className="fill-surface stroke-ink" />
          <rect x="226" y="44" width="16" height="90" className="fill-surface stroke-ink" />
          <rect x="44" y="170" width="54" height="36" className="fill-brand stroke-ink" strokeWidth="1.5" />
          <rect x="52" y="206" width="38" height="18" className="fill-surface stroke-ink" />
          <rect x="26" y="176" width="18" height="24" className="fill-surface stroke-ink" />
          <text x="54" y="192" className="fill-on-brand text-[10px] font-medium">Table 1</text>
        </svg>
        <span className="absolute top-[5%] left-[30%]"><Marker n={1} /></span>
        <span className="absolute top-[62%] left-[38%]"><Marker n={2} /></span>
        <span className="absolute right-[34%] bottom-[-2%]"><Marker n={3} /></span>
      </div>
      <div className="-mx-4 mt-auto rounded-t-2xl border-t border-line bg-raised px-4 pt-2 pb-3">
        <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line" />
        <div className="mb-2 flex items-center justify-between">
          <span>
            <span className="block text-sm font-semibold text-ink">Table 1</span>
            <span className="block text-xs text-ink-muted">Front tables · Published v4</span>
          </span>
          <Marker n={4} />
        </div>
        <MockGrid
          cols={8}
          rows={2}
          rowHeight="1.5rem"
          tiles={[
            { label: "Tee", col: 0, row: 0, w: 2, h: 2, tone: 3 },
            { label: "Crew", col: 2, row: 0, w: 2, h: 1, tone: 6 },
            { label: "Polo", col: 4, row: 0, w: 4, h: 2, tone: 2 },
          ]}
        />
      </div>
    </MockScreen>
  );
}
