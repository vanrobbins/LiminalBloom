// An entrance: a gap cut in the wall, with small marks at its ends.

import { entranceEnds } from "@/lib/layout/entrances";
import type { Entrance, Point } from "@/lib/layout/types";

type EntranceShapeProps = { entrance: Entrance; outline: Point[]; selected: boolean; problem: boolean };

export function EntranceShape({ entrance, outline, selected, problem }: EntranceShapeProps) {
  const ends = entranceEnds(entrance, outline);
  if (!ends) return null;
  const [a, b] = ends;
  return (
    <g data-entrance-id={entrance.id} data-problem={problem || undefined}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--surface)" strokeWidth={7} vectorEffect="non-scaling-stroke" />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={problem ? "var(--danger)" : selected ? "var(--brand)" : "var(--ink-muted)"}
        strokeWidth={selected ? 2.5 : 1}
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}
