// A zone: its fill colour, its name (top-left, fitted: UX audit U5), and how
// it shows selection and problems.

import type { ZoneLabel } from "@/lib/layout/zone-label";
import type { Zone } from "@/lib/layout/types";

/** `label`: placed by zoneLabels, clear of the fixtures; null when it has no room. */
type ZoneShapeProps = { zone: Zone; label: ZoneLabel | null; dimmed: boolean; selected: boolean; problem: boolean };

export function ZoneShape({ zone, label, dimmed, selected, problem }: ZoneShapeProps) {
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
          fontSize={label.fontSize}
          dominantBaseline="middle"
          fill="var(--ink)"
          fontWeight={500}
          className="pointer-events-none select-none"
        >
          {label.text !== zone.name ? <title>{zone.name}</title> : null}
          {label.text}
        </text>
      ) : null}
    </g>
  );
}
