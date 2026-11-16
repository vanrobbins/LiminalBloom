// How many px one grid unit is drawn at right now (0 until measured): the corner
// discs size and place themselves in px, which the grid's CSS-only --cell can't say.

"use client";

import { useEffect, useState, type RefObject } from "react";

/** `units` is the drawing space's width in units; `watch` changes when the element is replaced (a keyed remount). */
export function useCellPx(ref: RefObject<HTMLElement | null>, units: number, watch?: unknown): number {
  const [px, setPx] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || units <= 0) return;
    const update = () => setPx(el.getBoundingClientRect().width / units);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, units, watch]);
  return px;
}
