// A resize handle on the moving tile (grid-tile.tsx).

"use client";

import type { Edge } from "@/lib/planograms/builder/resize";
import type { Rect } from "@/lib/planograms/set-grid";

import { at, KEEP_TOUCH, type Gestures } from "./grid-units";

// Each handle's 44 px target sits just outside its edge, the visible bar on the
// edge. Where that edge is the drawing space's own, outside would be clipped or
// add scroll, so the target turns inward over the tile (the bar stays on the edge).
type Place = { shift: string; align: string };
type HandleSpec = { at: (r: Rect) => [number, number]; atBound: (r: Rect, b: { width: number; height: number }) => boolean; out: Place; in: Place; cursor: string; bar: string };
const HANDLE: Record<Edge, HandleSpec> = {
  left: {
    at: (r) => [r.x, r.y + r.height / 2],
    atBound: (r) => r.x <= 0,
    out: { shift: "translate(-100%, -50%)", align: "items-center justify-end" },
    in: { shift: "translate(0, -50%)", align: "items-center justify-start" },
    cursor: "cursor-ew-resize",
    bar: "h-5 w-1.5",
  },
  right: {
    at: (r) => [r.x + r.width, r.y + r.height / 2],
    atBound: (r, b) => r.x + r.width >= b.width,
    out: { shift: "translate(0, -50%)", align: "items-center justify-start" },
    in: { shift: "translate(-100%, -50%)", align: "items-center justify-end" },
    cursor: "cursor-ew-resize",
    bar: "h-5 w-1.5",
  },
  top: {
    at: (r) => [r.x + r.width / 2, r.y],
    atBound: (r) => r.y <= 0,
    out: { shift: "translate(-50%, -100%)", align: "items-end justify-center" },
    in: { shift: "translate(-50%, 0)", align: "items-start justify-center" },
    cursor: "cursor-ns-resize",
    bar: "h-1.5 w-5",
  },
  bottom: {
    at: (r) => [r.x + r.width / 2, r.y + r.height],
    atBound: (r, b) => r.y + r.height >= b.height,
    out: { shift: "translate(-50%, 0)", align: "items-start justify-center" },
    in: { shift: "translate(-50%, -100%)", align: "items-end justify-center" },
    cursor: "cursor-ns-resize",
    bar: "h-1.5 w-5",
  },
};

export function TileHandle({ edge, rect, bounds, gestures }: { edge: Edge; rect: Rect; bounds: { width: number; height: number }; gestures: Gestures }) {
  const h = HANDLE[edge];
  const [x, y] = h.at(rect);
  const inward = h.atBound(rect, bounds);
  const place = inward ? h.in : h.out;
  return (
    // Shift+arrows resize from the keyboard; the handle is for pointers only.
    <div
      aria-hidden="true"
      data-handle={edge}
      data-inward={inward ? "" : undefined}
      onPointerDown={gestures.start(edge)}
      {...gestures.handlers}
      {...KEEP_TOUCH}
      className={`absolute z-20 flex size-11 touch-none ${place.align} ${h.cursor}`}
      style={{ left: at(x), top: at(y), transform: place.shift }}
    >
      <span className={`rounded-full border border-surface bg-ink ${h.bar}`} />
    </div>
  );
}
