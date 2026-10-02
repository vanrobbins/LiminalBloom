// The line a drag has snapped to, across the whole view.

import { worldToScreen, type Camera, type Viewport } from "@/lib/layout/camera";
import type { Guide } from "@/lib/layout/snap";

export function SnapGuides({ guides, camera, viewport }: { guides: readonly Guide[]; camera: Camera; viewport: Viewport }) {
  return (
    <g className="pointer-events-none">
      {guides.map((guide, i) => {
        const p = worldToScreen(camera, { x: guide.value, y: guide.value });
        return guide.axis === "x" ? (
          <line key={i} x1={p.x} y1={0} x2={p.x} y2={viewport.height} stroke="var(--brand-strong)" strokeDasharray="4 4" />
        ) : (
          <line key={i} x1={0} y1={p.y} x2={viewport.width} y2={p.y} stroke="var(--brand-strong)" strokeDasharray="4 4" />
        );
      })}
    </g>
  );
}
