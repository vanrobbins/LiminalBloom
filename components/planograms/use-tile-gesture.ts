// One press on the moving tile or one of its handles (Part 2 spec §4): a tap,
// or a drag measured in grid units from where it began, so each frame is
// rebuilt from the start (store-map rule). Pointer capture keeps a fast drag
// attached; the tile sets touch-action: none, so a touch drag arrives as
// pointer events instead of scrolling the page. Dragging near the scroller's
// edge scrolls it, and the scroll counts toward the drag.

"use client";

import { useRef } from "react";

import type { Edge } from "@/lib/planograms/builder/resize";

export type GestureMode = "move" | Edge;
export type Gesture = { mode: GestureMode; dx: number; dy: number };

/** A press that travels less than this is a tap. */
export const DRAG_START_PX = 4;
const EDGE_PX = 32;
const SCROLL_STEP_PX = 12;

type Press = { mode: GestureMode; id: number; x: number; y: number; scroll: number; moved: boolean };

type Options = {
  /** Pixels per grid unit right now. */
  unitPx: () => number;
  scroller: () => HTMLElement | null;
  onMove: (gesture: Gesture) => void;
  /** The finished drag, or null for a tap or a cancelled press. */
  onEnd: (gesture: Gesture | null) => void;
};

export function useTileGesture({ unitPx, scroller, onMove, onEnd }: Options) {
  const press = useRef<Press | null>(null);
  const dragged = useRef(false);

  function measure(p: Press, e: React.PointerEvent): Gesture {
    const unit = unitPx() || 1;
    const scrolled = (scroller()?.scrollLeft ?? 0) - p.scroll;
    return { mode: p.mode, dx: (e.clientX - p.x + scrolled) / unit, dy: (e.clientY - p.y) / unit };
  }

  function start(mode: GestureMode) {
    return (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      // The grid's own swipe never sees a press on the moving tile (Review Focus 1).
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragged.current = false;
      press.current = { mode, id: e.pointerId, x: e.clientX, y: e.clientY, scroll: scroller()?.scrollLeft ?? 0, moved: false };
    };
  }

  const handlers = {
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      p.moved = true;
      const el = scroller();
      if (el && el.scrollWidth > el.clientWidth) {
        const box = el.getBoundingClientRect();
        if (e.clientX < box.left + EDGE_PX) el.scrollLeft -= SCROLL_STEP_PX;
        else if (e.clientX > box.right - EDGE_PX) el.scrollLeft += SCROLL_STEP_PX;
      }
      onMove(measure(p, e));
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      press.current = null;
      dragged.current = p.moved;
      onEnd(p.moved ? measure(p, e) : null);
    },
    onPointerCancel(e: React.PointerEvent<HTMLElement>) {
      if (!press.current || e.pointerId !== press.current.id) return;
      press.current = null;
      onEnd(null);
    },
  };

  /** True once after a drag: the click that ends a drag is not also a tap. */
  function consumeDrag(): boolean {
    const was = dragged.current;
    dragged.current = false;
    return was;
  }

  return { start, handlers, consumeDrag };
}
