// A still touch press of LONG_PRESS_MS opens a name (0.7.0.5 R1): Radix
// tooltips never open on touch. Only pointerType "touch" counts; a mouse is
// left to hover. The press that showed the name must not also click.

"use client";

import { useRef } from "react";

import { DRAG_START_PX } from "@/components/planograms/use-tile-gesture";

export const LONG_PRESS_MS = 500;

/** Spread the handlers on the control; `onLongPress` is called once per held press. */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const touching = useRef(false);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    touching.current = false;
  }

  return {
    onPointerDown(e: React.PointerEvent) {
      cancel();
      fired.current = false;
      if (e.pointerType !== "touch") return;
      touching.current = true;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: React.PointerEvent) {
      const from = start.current;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_START_PX) cancel();
    },
    // The click that follows a released long press is swallowed (capture, so the control never sees it).
    onPointerUp: () => {
      if (timer.current) cancel();
      touching.current = false;
    },
    onPointerCancel: cancel,
    onClickCapture(e: React.MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // The native menu / text selection of a touch long press, only while one is in play.
    onContextMenu(e: React.MouseEvent) {
      if (touching.current || fired.current) e.preventDefault();
    },
  };
}
