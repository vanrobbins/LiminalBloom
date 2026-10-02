// Handles drawn in screen space, so they stay 10 px however far you zoom
// (spec §7); their hit area is the 44 px circle hitTest() uses.

import { worldToScreen, type Camera } from "@/lib/layout/camera";
import type { HandleSpot } from "@/lib/layout/hit-test";
import type { VertexRef } from "@/lib/layout/session-core";

type SelectionHandlesProps = { handles: readonly HandleSpot[]; camera: Camera; vertex: VertexRef | null };

export function SelectionHandles({ handles, camera, vertex }: SelectionHandlesProps) {
  return (
    <g className="pointer-events-none">
      {handles.map(({ ref, at }, i) => {
        const p = worldToScreen(camera, at);
        const chosen = ref.kind === "vertex" && vertex?.index === ref.index && vertex.owner.kind === ref.owner.kind;
        if (ref.kind === "midpoint") {
          return (
            <g key={i} data-handle="midpoint" transform={`translate(${p.x} ${p.y})`}>
              <circle r={7} fill="var(--raised)" stroke="var(--brand-strong)" strokeWidth={1.5} />
              <path d="M -3.5 0 H 3.5 M 0 -3.5 V 3.5" stroke="var(--brand-strong)" strokeWidth={1.5} />
            </g>
          );
        }
        if (ref.kind === "rotate") {
          return <circle key={i} data-handle="rotate" cx={p.x} cy={p.y} r={6} fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.5} />;
        }
        return (
          <rect
            key={i}
            data-handle={ref.kind}
            x={p.x - 5}
            y={p.y - 5}
            width={10}
            height={10}
            rx={ref.kind === "vertex" ? 5 : 2}
            fill="var(--brand)"
            stroke={chosen ? "var(--ink)" : "var(--raised)"}
            strokeWidth={chosen ? 3 : 2}
          />
        );
      })}
    </g>
  );
}
