// Dragging a tile on the face grid: pointer movement becomes whole cells,
// measured from where the press started. Selecting goes through click, so a
// keyboard's Enter works too; the click that ends a drag is ignored.

"use client";

import { useRef, useState } from "react";

export type DragTarget = { id: string; col: number; row: number };

type Options = {
  cols: number;
  rows: number;
  onTap: (id: string) => void;
  onDrop: (target: DragTarget) => void;
};

export function useTileDrag({ cols, rows, onTap, onDrop }: Options) {
  const grid = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: string; x: number; y: number; col: number; row: number } | null>(null);
  const dragged = useRef(false);
  const [target, setTarget] = useState<DragTarget | null>(null);

  function cellsMoved(event: React.PointerEvent) {
    const box = grid.current?.getBoundingClientRect();
    const from = start.current;
    if (!box || !from) return null;
    return {
      id: from.id,
      col: from.col + Math.round(((event.clientX - from.x) / box.width) * cols),
      row: from.row + Math.round(((event.clientY - from.y) / box.height) * rows),
    };
  }

  function press(id: string, col: number, row: number) {
    return {
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { id, x: event.clientX, y: event.clientY, col, row };
        // Some browsers send no click after a captured drag; a new press starts clean.
        dragged.current = false;
      },
      onPointerMove(event: React.PointerEvent) {
        const next = cellsMoved(event);
        if (next && (next.col !== col || next.row !== row || target)) setTarget(next);
      },
      onPointerUp(event: React.PointerEvent) {
        const next = cellsMoved(event);
        start.current = null;
        setTarget(null);
        if (!next || (next.col === col && next.row === row)) return;
        dragged.current = true;
        onDrop(next);
      },
      onClick() {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onTap(id);
      },
      onPointerCancel() {
        start.current = null;
        setTarget(null);
      },
    };
  }

  return { grid, target, press };
}
