// One face's surface beneath the tiles: its levels, and its name in a table
// set's combined view.

"use client";

import { ROW_UNITS, type Block } from "@/lib/planograms/set-grid";

import { at } from "./grid-units";

export function BlockView({ block, labelled, onEmpty }: { block: Block; labelled: boolean; onEmpty?: () => void }) {
  // Shelves and rails are physical, so a standing face shows its levels; a table top has none
  // (turned blocks are always lower table tops, so the rules below are never turned).
  const rules = block.side === "top" || block.turned ? 0 : block.rows - 1;
  return (
    <div
      data-block={block.faceId}
      onClick={onEmpty}
      className="absolute rounded-sm border border-line-subtle bg-raised"
      style={{ left: at(block.x), top: at(block.y), width: at(block.width), height: at(block.height) }}
    >
      {labelled ? (
        <span aria-hidden="true" className="absolute -top-px left-0 -translate-y-full pb-0.5 text-xs whitespace-nowrap text-ink-muted">
          {block.corner ? (
            <svg data-corner-mark viewBox="0 0 10 10" className="mr-1 inline size-2.5 align-baseline">
              <path d="M2 1 V8 H9" fill="none" stroke="currentColor" strokeWidth={2} />
            </svg>
          ) : null}
          {block.back ? (
            // A U-turn: the run doubles back behind the rack before.
            <svg data-back-mark viewBox="0 0 10 10" className="mr-1 inline size-2.5 align-baseline">
              <path d="M2 9 V4 A3 3 0 0 1 8 4 V9" fill="none" stroke="currentColor" strokeWidth={2} />
            </svg>
          ) : null}
          {block.label}
        </span>
      ) : null}
      {Array.from({ length: rules }, (_, i) => (
        <span key={i} aria-hidden="true" data-level-rule className="absolute inset-x-0 border-t border-line-subtle" style={{ top: at((i + 1) * ROW_UNITS) }} />
      ))}
    </div>
  );
}
