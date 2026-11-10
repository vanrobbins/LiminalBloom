// What shows only while a tile is dragged (Part 2 spec §4 "Look"): half-foot
// guides and a feet ruler on each face, the snapped spot the tile will land on
// (dashed; brick when it can't go there), and a chip saying where that is in
// words, or why not (with a warning icon). Visual only: the screen's live region speaks moves.

import { AlertTriangle } from "lucide-react";

import { COLUMNS_PER_FOOT } from "@/lib/feet";
import type { GridLayout, Rect } from "@/lib/planograms/set-grid";

import { at, placed } from "./grid-units";

export function DragGuides({ layout }: { layout: GridLayout }) {
  return (
    <>
      {layout.blocks.map((b) => (
        <div
          key={b.faceId}
          aria-hidden="true"
          data-guides
          className="pointer-events-none absolute"
          style={{
            left: at(b.x),
            top: at(b.y),
            width: at(b.width),
            height: at(b.height),
            backgroundImage: `repeating-linear-gradient(${b.turned ? "to bottom" : "to right"}, var(--color-line) 0 1px, transparent 1px var(--cell))`,
          }}
        >
          {b.turned
            ? null
            : Array.from({ length: Math.floor(b.columns / COLUMNS_PER_FOOT) + 1 }, (_, ft) => (
                <span key={ft} className="absolute -top-px -translate-x-1/2 -translate-y-full text-xs text-ink-muted tabular-nums" style={{ left: at(ft * COLUMNS_PER_FOOT) }}>
                  {ft}
                </span>
              ))}
        </div>
      ))}
    </>
  );
}

export function DropGhost({ rect, invalid }: { rect: Rect; invalid: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-drop-ghost
      data-invalid={invalid ? "" : undefined}
      className="pointer-events-none absolute rounded-md border-2 border-dashed border-ink data-invalid:border-danger"
      style={placed(rect)}
    />
  );
}

export function DragChip({ rect, text, invalid }: { rect: Rect; text: string; invalid: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-drag-chip
      data-invalid={invalid ? "" : undefined}
      className="pointer-events-none absolute z-30 inline-flex -translate-y-full items-center gap-1 rounded border border-ink bg-ink px-2 py-0.5 text-xs whitespace-nowrap text-surface data-invalid:border-danger data-invalid:bg-danger-tint data-invalid:text-danger"
      style={{ left: at(rect.x), top: `calc(${at(rect.y)} - 2px)` }}
    >
      {/* A refusal is words and an icon, never colour alone. */}
      {invalid ? <AlertTriangle aria-hidden="true" strokeWidth={2} className="size-3" /> : null}
      {text}
    </span>
  );
}
