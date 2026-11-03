// The demo store's floor plan: zones, the entrance and each fixture. Fixtures
// are buttons when `onPick` is given; the highlighted one is filled gold.

"use client";

import { FIXTURES, ZONES } from "@/lib/demo/seed";

import { ZONE_FILL } from "./looks";

type StoreMapProps = { highlightId?: string | null; onPick?: (fixtureId: string) => void; compact?: boolean };

export function StoreMap({ highlightId, onPick, compact = false }: StoreMapProps) {
  return (
    <svg viewBox="0 0 300 236" role="group" aria-label="Store map" className="w-full rounded border border-line bg-raised">
      <rect x="2" y="2" width="296" height="232" className="fill-none stroke-ink" strokeWidth="2" />
      <rect x="140" y="228" width="44" height="8" className="fill-raised" />
      {compact ? null : (
        <text x="146" y="222" className="fill-ink-muted text-[8px]">
          Entrance
        </text>
      )}
      {ZONES.map((zone) => (
        <g key={zone.id}>
          <polygon points={zone.points} className={ZONE_FILL[zone.tone]} />
          {compact ? null : (
            <text x={zone.label.x} y={zone.label.y} className="fill-ink text-[10px] font-medium">
              {zone.name}
            </text>
          )}
        </g>
      ))}
      {FIXTURES.map((fixture) => {
        const isOn = fixture.id === highlightId;
        const { x, y, w, h } = fixture.map;
        const shape = (
          <>
            <rect data-shape x={x} y={y} width={w} height={h} rx="1.5" className={`${isOn ? "fill-brand" : "fill-surface"} stroke-ink`} strokeWidth={isOn ? 2 : 1} />
            {compact ? null : (
              <text x={w > h ? x + 4 : x + w + 4} y={w > h ? y + h + 11 : y + 10} className="fill-ink text-[8.5px]">
                {fixture.name}
              </text>
            )}
          </>
        );
        if (!onPick) return <g key={fixture.id}>{shape}</g>;
        return (
          <g
            key={fixture.id}
            role="button"
            tabIndex={0}
            aria-label={fixture.name}
            aria-pressed={isOn}
            onClick={() => onPick(fixture.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPick(fixture.id);
              }
            }}
            className="cursor-pointer outline-none focus-visible:[&_[data-shape]]:stroke-[3]"
          >
            {/* A larger invisible target, so a thin wall is easy to tap. */}
            <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} className="fill-transparent" />
            {shape}
          </g>
        );
      })}
    </svg>
  );
}
