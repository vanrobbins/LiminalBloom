// A tap on empty grid space (0.7.0.5 task 7, spec §2.2). With a tile selected it only deselects, as it always has.
// With nothing selected and a builder that can add, a still tap asks to add at the tapped face, column and row, and
// Enter on the focused grid asks for the first open spot (no cell). "Still" is the press's own: it travelled less
// than the drag threshold and the grid did not scroll under it, so the end of a pan or a scroll never adds.
// A click with no press before it (assistive tech) is a tap, and so is one after a press whose release landed
// elsewhere (no click came for it). Read-only grids have no builder, so nothing happens. The grid is a tab stop while
// Enter can add (nothing selected, an onAdd), and says so.

"use client";

import { useEffect, useRef } from "react";

import { cellAt, type GridLayout } from "@/lib/planograms/set-grid";

import type { GridBuilder } from "./grid-builder";
import { DRAG_START_PX } from "./use-tile-gesture";

type Options = {
  builder: GridBuilder | undefined;
  selected: boolean;
  layout: GridLayout;
  /** The drawing space (one unit is its width over the layout's), and the box that scrolls it. */
  space: () => HTMLElement | null;
  scroller: () => HTMLElement | null;
};

/** After a release the click follows at once; a press still held this long after its release will get none. */
const CLICK_WAITS_MS = 300;
const HINT = "Press Enter to add a product at the first open spot.";

export function useEmptyTap({ builder, selected, layout, space, scroller }: Options) {
  const canAdd = !selected && builder?.onAdd != null;
  const press = useRef<{ x: number; y: number; scroll: number } | null>(null);

  /** Drops the last press's pending release listener and timer (a newer press, or leaving). */
  const forget = useRef<(() => void) | null>(null);
  useEffect(() => () => forget.current?.(), []);

  function still(e: React.MouseEvent): boolean {
    const from = press.current;
    press.current = null;
    if (!from) return true;
    return Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_START_PX && (scroller()?.scrollLeft ?? 0) === from.scroll;
  }

  function onClick(e: React.MouseEvent) {
    if (!builder) return;
    const isStill = still(e);
    if (selected || !builder.onAdd) return builder.onEmpty();
    if (!isStill) return;
    const rect = space()?.getBoundingClientRect();
    const unit = rect && layout.width > 0 ? rect.width / layout.width : 0;
    const cell = rect && unit > 0 ? cellAt(layout.blocks, (e.clientX - rect.left) / unit, (e.clientY - rect.top) / unit) : null;
    if (cell) builder.onAdd(cell);
  }

  return {
    /** Spread on each block's surface; absent when nothing may change. */
    block: builder
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            forget.current?.();
            const mine = { x: e.clientX, y: e.clientY, scroll: scroller()?.scrollLeft ?? 0 };
            press.current = mine;
            // Released anywhere: the click, if any, is on its way; if none came the press is stale. Only its own.
            let timer: ReturnType<typeof setTimeout> | undefined;
            const released = () => {
              timer = setTimeout(() => {
                if (press.current === mine) press.current = null;
              }, CLICK_WAITS_MS);
            };
            window.addEventListener("pointerup", released, { once: true });
            forget.current = () => {
              window.removeEventListener("pointerup", released);
              clearTimeout(timer);
            };
          },
          onPointerCancel: () => {
            press.current = null;
          },
          onClick,
        }
      : undefined,
    /**
     * Spread on the grid itself: Enter, with the grid and not a tile focused, and the tab stop for it. Otherwise
     * -1: focus still lands here from code (a removed tile's focus), but Tab skips it.
     */
    section: {
      tabIndex: canAdd ? 0 : -1,
      "aria-description": canAdd ? HINT : undefined,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key !== "Enter" || e.target !== e.currentTarget || !canAdd) return;
        e.preventDefault();
        builder?.onAdd?.();
      },
    },
  };
}
