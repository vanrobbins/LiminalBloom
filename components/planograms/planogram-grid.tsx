// A planogram's grid (spec §5.2): one face, or a table set's combined view.
// Same cell drawing as components/search/face-grid.tsx, with every placement
// named and marked hung (H) or folded (F) with its piece count. Taps are a
// shortcut; the placement list beside it is the keyboard route.

"use client";

import { columnLetters } from "@/lib/products/location-label";
import { spanRect, type GridLayout } from "@/lib/planograms/set-grid";

import type { GridItem } from "./grid-items";

const CELL = 10;
const PAD = CELL;

type PlanogramGridProps = {
  layout: GridLayout;
  items: readonly GridItem[];
  label: string;
  selectedId?: string | null;
  highlightProductId?: string | null;
  issues?: ReadonlyMap<string, string>;
  onSelect?: (id: string) => void;
  onEmptyCell?: (cell: { faceId: string; col: number; row: number }) => void;
};

export function PlanogramGrid({ layout, items, label, selectedId, highlightProductId, issues, onSelect, onEmptyCell }: PlanogramGridProps) {
  const width = layout.width * CELL + PAD * 2;
  const height = layout.height * CELL + PAD * 2;
  const at = (n: number) => PAD + n * CELL;
  const drawn = items.filter((item) => layout.blocks.some((b) => b.faceId === item.faceId));
  const count = `${drawn.length} ${drawn.length === 1 ? "product" : "products"}`;

  return (
    <svg role="img" aria-label={`${label}: ${count}`} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl touch-manipulation">
      {layout.blocks.map((block) => (
        <g key={block.faceId}>
          {layout.blocks.length > 1 ? (
            <text x={at(block.x)} y={at(block.y) - 2} className="fill-ink-muted text-[3.5px]">
              {block.label}
            </text>
          ) : (
            Array.from({ length: block.columns }, (_, col) => (
              <text key={col} x={at(block.x + col + 0.5)} y={at(block.y) - 2} textAnchor="middle" className="fill-ink-muted text-[3.5px]">
                {columnLetters(col)}
              </text>
            ))
          )}
          {Array.from({ length: block.rows }, (_, row) =>
            Array.from({ length: block.columns }, (_, col) => {
              const r = spanRect(block, { col, row, colSpan: 1, rowSpan: 1 });
              return (
                <rect
                  key={`${col}-${row}`}
                  data-cell={`${block.faceId}:${col}:${row}`}
                  x={at(r.x)}
                  y={at(r.y)}
                  width={CELL}
                  height={CELL}
                  onClick={onEmptyCell ? () => onEmptyCell({ faceId: block.faceId, col, row }) : undefined}
                  className="fill-raised stroke-line"
                  strokeWidth={0.4}
                />
              );
            }),
          )}
        </g>
      ))}
      {drawn.map((item) => {
        const block = layout.blocks.find((b) => b.faceId === item.faceId);
        if (!block) return null;
        const r = spanRect(block, item);
        const isMarked = item.id === selectedId || item.productId === highlightProductId;
        const hasIssue = issues?.has(item.id) ?? false;
        return (
          <g
            key={item.id}
            data-placement={item.id}
            data-marked={isMarked ? "" : undefined}
            onClick={onSelect ? () => onSelect(item.id) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <rect
              x={at(r.x) + 0.6}
              y={at(r.y) + 0.6}
              width={r.width * CELL - 1.2}
              height={r.height * CELL - 1.2}
              rx={1}
              className={isMarked ? "fill-brand stroke-ink" : hasIssue ? "fill-danger-tint stroke-danger" : "fill-line-subtle stroke-ink"}
              strokeWidth={isMarked ? 1.4 : hasIssue ? 0.9 : 0.5}
              strokeDasharray={hasIssue ? "1.5 1" : undefined}
            />
            <text x={at(r.x) + 1.5} y={at(r.y) + 4.5} className={`text-[3px] ${isMarked ? "fill-on-brand" : "fill-ink"}`}>
              {item.productName.slice(0, Math.max(3, Math.floor(r.width * 3)))}
            </text>
            <text x={at(r.x) + 1.5} y={at(r.y) + 8.5} className={`font-mono text-[3px] ${isMarked ? "fill-on-brand" : "fill-ink-muted"}`}>
              {item.presentation === "hung" ? "H" : "F"}
              {item.pieceCount}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
