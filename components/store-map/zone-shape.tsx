// A zone: its fill colour, its name, and how it shows selection and problems.

import { interiorPoint } from "@/lib/layout/geometry";
import type { Zone } from "@/lib/layout/types";

type ZoneShapeProps = { zone: Zone; scale: number; dimmed: boolean; selected: boolean; problem: boolean };

export function ZoneShape({ zone, scale, dimmed, selected, problem }: ZoneShapeProps) {
  const label = zone.points.length >= 3 ? interiorPoint(zone.points) : null;
  return (
    <g data-zone-id={zone.id} data-zone-name={zone.name} data-problem={problem || undefined} opacity={dimmed ? 0.35 : 1}>
      <polygon
        points={zone.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill={`var(--${zone.color})`}
        stroke={problem ? "var(--danger)" : selected ? "var(--brand)" : "var(--line)"}
        strokeWidth={selected || problem ? 2.5 : 1}
        strokeDasharray={problem ? "6 4" : selected ? "8 4" : undefined}
        vectorEffect="non-scaling-stroke"
      />
      {label ? (
        <text
          x={label.x}
          y={label.y}
          fontSize={13 / scale}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--ink)"
          className="pointer-events-none select-none"
        >
          {zone.name}
        </text>
      ) : null}
    </g>
  );
}
