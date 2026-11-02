// A run of three frame racks in an L on the map, and its planogram drawn
// as one long rail.

import { Marker } from "../marker";
import { MockGrid } from "../mock/mock-grid";
import { MockScreen } from "../mock/mock-screen";

function Rack({ x, y, vertical }: { x: number; y: number; vertical?: boolean }) {
  const [w, h] = vertical ? [14, 70] : [70, 14];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className="fill-raised stroke-ink" strokeWidth="1.5" />
      {vertical ? (
        <line x1={x + 7} y1={y + 4} x2={x + 7} y2={y + h - 4} className="stroke-ink" strokeWidth="2" />
      ) : (
        <line x1={x + 4} y1={y + 7} x2={x + w - 4} y2={y + 7} className="stroke-ink" strokeWidth="2" />
      )}
    </g>
  );
}

export function FrameRunScreen() {
  return (
    <MockScreen title="Back wall run" tab="planograms">
      <div className="relative rounded-lg border border-line bg-raised">
        <svg viewBox="0 0 260 150" aria-hidden="true" className="w-full">
          <rect x="16" y="16" width="40" height="40" className="fill-line-subtle stroke-line" />
          <text x="20" y="40" className="fill-ink text-[9px]">Column</text>
          <Rack x={60} y={22} />
          <Rack x={132} y={22} />
          <Rack x={190} y={38} vertical />
          <rect x="56" y="18" width="152" height="94" rx="4" className="fill-none stroke-brand" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        <span className="absolute top-[10%] left-[34%]"><Marker n={1} /></span>
        <span className="absolute top-[64%] left-[60%]"><Marker n={2} /></span>
      </div>
      <span className="flex items-center justify-between text-sm font-semibold text-ink">
        Rail · 3 racks · 11 ft <Marker n={3} />
      </span>
      <MockGrid
        cols={22}
        rows={1}
        rowHeight="3.5rem"
        tiles={[
          { label: "Tee", col: 0, row: 0, w: 3, h: 1, tone: 4 },
          { label: "Shirt", col: 3, row: 0, w: 3, h: 1, tone: 4 },
          { label: "Dress", col: 7, row: 0, w: 4, h: 1, tone: 3 },
          { label: "Coat", col: 12, row: 0, w: 4, h: 1, tone: 2 },
          { label: "Jean", col: 17, row: 0, w: 3, h: 1, tone: 2, look: "selected" },
        ]}
      />
      <span className="flex justify-between text-[0.625rem] text-ink-muted">
        <span>Left frame</span><span>Middle frame</span><span>Right frame</span>
      </span>
      <span className="mt-auto flex items-center gap-2">
        <span className="flex flex-1 items-center justify-between rounded-lg bg-ink px-3 py-2 text-xs text-surface">
          Switched to hung
          <span className="font-semibold underline underline-offset-4">Undo</span>
        </span>
        <Marker n={4} />
      </span>
    </MockScreen>
  );
}
