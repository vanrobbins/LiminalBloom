// The custom outline being drawn: corners so far, the next wall following
// the pointer, and each wall's length (spec §10).

import { worldToScreen, type Camera } from "@/lib/layout/camera";
import { formatLength } from "@/lib/layout/format";
import { distance } from "@/lib/layout/geometry";
import type { Drawing } from "@/lib/layout/outline-draw";
import type { Point } from "@/lib/layout/types";

export function DrawingOverlay({ drawing, preview, camera }: { drawing: Drawing; preview: Point | null; camera: Camera }) {
  const points = preview ? [...drawing.points, preview] : drawing.points;
  const screen = points.map((p) => worldToScreen(camera, p));
  return (
    <g className="pointer-events-none">
      <polyline points={screen.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--ink)" strokeWidth={2} />
      {screen.slice(1).map((p, i) => (
        <text
          key={`len-${i}`}
          x={(p.x + screen[i].x) / 2}
          y={(p.y + screen[i].y) / 2 - 8}
          fontSize={12}
          textAnchor="middle"
          fill="var(--ink)"
        >
          {formatLength(distance(points[i], points[i + 1]))}
        </text>
      ))}
      {screen.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 9 : 5} fill={i === 0 ? "var(--brand)" : "var(--ink)"} />
      ))}
    </g>
  );
}
