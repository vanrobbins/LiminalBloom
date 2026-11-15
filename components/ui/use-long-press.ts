// A still touch press of LONG_PRESS_MS opens a name (0.7.0.5 R1): Radix
// tooltips never open on touch. Only pointerType "touch" counts; a mouse is
// left to hover. The press that showed the name must not also click.

"use client";

import { useEffect, useRef } from "react";

export const LONG_PRESS_MS = 500;
/** A touch that travels this far or more is no longer a still press or a tap (the tile gesture's drag start shares it). */
export const TAP_THRESHOLD_PX = 4;
// How long after release a swallowed click may still arrive; later, a click is a keyboard one.
const CLICK_WINDOW_MS = 400;

/** Spread the handlers on the control; `onLongPress` is called once per held press. */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const touching = useRef(false);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    touching.current = false;
  }

  function clearRelease() {
    if (release.current) clearTimeout(release.current);
    release.current = null;
  }

  // A press still pending when the control goes away must not open anything.
  useEffect(
    () => () => {
      cancel();
      clearRelease();
    },
    [],
  );

  return {
    onPointerDown(e: React.PointerEvent) {
      // A second finger does not restart the press that is already running.
      if (touching.current && e.pointerType === "touch") return;
      cancel();
      clearRelease();
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
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) >= TAP_THRESHOLD_PX) cancel();
    },
    // The click that follows a released long press is swallowed (capture, so the control never sees it).
    onPointerUp: () => {
      if (timer.current) cancel();
      touching.current = false;
      // If the browser never sends the click, a later keyboard click must not be eaten.
      if (fired.current) release.current = setTimeout(() => (fired.current = false), CLICK_WINDOW_MS);
    },
    onPointerCancel() {
      cancel();
      clearRelease();
      fired.current = false;
    },
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
