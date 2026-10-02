// The store's walls.

import type { Point } from "@/lib/layout/types";

export function OutlineShape({ points, selected, problem }: { points: Point[]; selected: boolean; problem: boolean }) {
  return (
    <polygon
      data-outline
      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      fill="var(--raised)"
      stroke={problem ? "var(--danger)" : selected ? "var(--brand)" : "var(--ink)"}
      strokeWidth={3}
      strokeDasharray={problem ? "6 4" : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}
