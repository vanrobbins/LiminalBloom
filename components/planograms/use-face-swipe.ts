// A sideways swipe on the planogram grid changes face (the screen decides).
// Touch is read from touch events: they keep coming while the browser scrolls
// the grid natively, where pointer events end in pointercancel. Mouse and pen
// use pointer events. The moving tile stops both (Review Focus 1).

"use client";

import { useRef } from "react";

import { SWIPE_MIN_PX } from "./face-swipe";
import type { Edges } from "./use-scroll-edges";

export type Swipe = { dx: number; dy: number; edges: Edges };

/** Handlers for the scrolling box. `edges` is read at the press, so a drag that scrolls the grid to its edge doesn't also change face; the next one does. */
export function useFaceSwipe(edges: Edges, onSwipe?: (gesture: Swipe) => void) {
  const start = useRef<{ x: number; y: number; edges: Edges } | null>(null);

  function begin(x: number, y: number) {
    start.current = { x, y, edges };
  }
  function end(x: number, y: number) {
    const from = start.current;
    start.current = null;
    if (!from || !onSwipe) return;
    const dx = x - from.x;
    // A tap or a nudge is not a swipe.
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    onSwipe({ dx, dy: y - from.y, edges: from.edges });
  }
  function cancel() {
    start.current = null;
  }

  return {
    onPointerDown: (e: React.PointerEvent) => (e.pointerType === "touch" ? undefined : begin(e.clientX, e.clientY)),
    onPointerUp: (e: React.PointerEvent) => (e.pointerType === "touch" ? undefined : end(e.clientX, e.clientY)),
    onPointerCancel: (e: React.PointerEvent) => (e.pointerType === "touch" ? undefined : cancel()),
    // A second finger makes it a pinch, not a swipe.
    onTouchStart: (e: React.TouchEvent) => (e.touches.length === 1 ? begin(e.touches[0].clientX, e.touches[0].clientY) : cancel()),
    onTouchEnd: (e: React.TouchEvent) =>
      e.touches.length === 0 && e.changedTouches.length > 0 ? end(e.changedTouches[0].clientX, e.changedTouches[0].clientY) : undefined,
    onTouchCancel: cancel,
  };
}

/** The fade on whichever edge the box can still scroll toward. */
export function edgeFade(edges: Edges): string | undefined {
  if (edges.left && edges.right) return "linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)";
  if (edges.right) return "linear-gradient(to right, black calc(100% - 2rem), transparent)";
  if (edges.left) return "linear-gradient(to left, black calc(100% - 2rem), transparent)";
  return undefined;
}
