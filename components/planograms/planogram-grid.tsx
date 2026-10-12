// A planogram's grid (spec §4.1): one face, or a table set's combined view.
// HTML, not SVG: every placement is a real button (keyboard and screen readers
// for free; Part 2's builder adds gestures to the same elements). Cells are
// square and fill the width, never under 40 px; a face too wide for that
// scrolls sideways inside the grid, with a fade on the clipped edge. The cell
// size is pure CSS (container query units), so the first paint is right.

"use client";

import { AlertTriangle } from "lucide-react";
import { useRef } from "react";

import { ProductImage } from "@/components/products/product-image";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import { columnLetters, spanLabel } from "@/lib/products/location-label";
import { spanRect, type GridLayout, type Rect } from "@/lib/planograms/set-grid";

import { SWIPE_MIN_PX } from "./face-swipe";
import type { GridItem } from "./grid-items";
import { useScrollEdges, type Edges } from "./use-scroll-edges";

/** Room for column letters above and row numbers to the left. */
const GUTTER = "1.5rem";
const at = (n: number) => `calc(var(--cell) * ${n})`;
/** A tile sits 1 px inside its cells, so neighbours read as separate. */
const placed = (r: Rect): React.CSSProperties => ({
  left: `calc(${at(r.x)} + 1px)`,
  top: `calc(${at(r.y)} + 1px)`,
  width: `calc(${at(r.width)} - 2px)`,
  height: `calc(${at(r.height)} - 2px)`,
});

type PlanogramGridProps = {
  layout: GridLayout;
  items: readonly GridItem[];
  label: string;
  selectedId?: string | null;
  highlightProductId?: string | null;
  issues?: ReadonlyMap<string, string>;
  onSelect: (id: string) => void;
  onEmptyCell?: (cell: { faceId: string; col: number; row: number }) => void;
  slideFrom?: "left" | "right" | null;
  onSwipe?: (gesture: { dx: number; dy: number; edges: Edges }) => void;
};

export function PlanogramGrid({ layout, items, label, selectedId, highlightProductId, issues, onSelect, onEmptyCell, slideFrom = null, onSwipe }: PlanogramGridProps) {
  const faceKey = layout.blocks.map((b) => b.faceId).join();
  const { ref, edges } = useScrollEdges<HTMLDivElement>(faceKey);
  // Where a drag began, and which way the grid could scroll then: a drag that
  // scrolls the grid to its edge doesn't also change face; the next one does.
  const start = useRef<{ x: number; y: number; edges: Edges } | null>(null);
  const drawn = items.filter((item) => layout.blocks.some((b) => b.faceId === item.faceId));
  const count = `${drawn.length} ${drawn.length === 1 ? "product" : "products"}`;
  const single = layout.blocks.length === 1 ? layout.blocks[0] : null;
  const mask =
    edges.left && edges.right
      ? "linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)"
      : edges.right
        ? "linear-gradient(to right, black calc(100% - 2rem), transparent)"
        : edges.left
          ? "linear-gradient(to left, black calc(100% - 2rem), transparent)"
          : undefined;
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
  const slide = slideFrom === "right" ? "motion-safe:animate-slide-from-right" : slideFrom === "left" ? "motion-safe:animate-slide-from-left" : "";

  return (
    <section
      aria-label={`${label}: ${count}`}
      data-planogram-grid
      // Focus lands here when the tile that had it is removed.
      tabIndex={-1}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div
        ref={ref}
        style={{ maskImage: mask }}
        // pr-1 pb-1: room for the ring and focus outline of the last column and row (overflow clips them).
        className="@container overflow-x-auto overscroll-x-contain pr-1 pb-1"
        // A sideways swipe changes face (the screen decides). Touch is read
        // from touch events: they keep coming while the browser scrolls the
        // grid natively, where pointer events end in pointercancel. Mouse and
        // pen use pointer events.
        onPointerDown={(e) => (e.pointerType === "touch" ? undefined : begin(e.clientX, e.clientY))}
        onPointerUp={(e) => (e.pointerType === "touch" ? undefined : end(e.clientX, e.clientY))}
        onPointerCancel={(e) => (e.pointerType === "touch" ? undefined : cancel())}
        // A second finger makes it a pinch, not a swipe.
        onTouchStart={(e) => (e.touches.length === 1 ? begin(e.touches[0].clientX, e.touches[0].clientY) : cancel())}
        onTouchEnd={(e) => (e.touches.length === 0 && e.changedTouches.length > 0 ? end(e.changedTouches[0].clientX, e.changedTouches[0].clientY) : undefined)}
        onTouchCancel={cancel}
      >
        <div
          // Remounts per face so the slide plays.
          key={faceKey}
          className={`relative ${slide}`}
          style={
            {
              "--cell": `max(2.5rem, calc((100cqw - ${GUTTER}) / ${layout.width}))`,
              width: `calc(${GUTTER} + ${at(layout.width)})`,
              height: `calc(${GUTTER} + ${at(layout.height)})`,
            } as React.CSSProperties
          }
        >
          {single
            ? Array.from({ length: single.columns }, (_, col) => (
                <span key={`c${col}`} aria-hidden="true" className="absolute top-0 flex h-6 items-center justify-center font-mono text-xs text-ink-muted" style={{ left: `calc(${GUTTER} + ${at(col)})`, width: at(1) }}>
                  {columnLetters(col)}
                </span>
              ))
            : null}
          {single
            ? Array.from({ length: single.rows }, (_, row) => (
                <span key={`r${row}`} aria-hidden="true" className="absolute left-0 flex w-6 items-center justify-center font-mono text-xs text-ink-muted" style={{ top: `calc(${GUTTER} + ${at(row)})`, height: at(1) }}>
                  {row + 1}
                </span>
              ))
            : null}
          <div className="absolute inset-0" style={{ left: GUTTER, top: GUTTER }}>
            {layout.blocks.map((block) => (
              <div key={block.faceId}>
                {layout.blocks.length > 1 ? (
                  <span aria-hidden="true" className="absolute -translate-y-full pb-0.5 text-xs text-ink-muted" style={{ left: at(block.x), top: at(block.y) }}>
                    {block.label}
                  </span>
                ) : null}
                {Array.from({ length: block.rows }, (_, row) =>
                  Array.from({ length: block.columns }, (_, col) => {
                    const r = spanRect(block, { col, row, colSpan: 1, rowSpan: 1 });
                    return (
                      // Taps on open cells are a shortcut; "Add product" is the keyboard route.
                      <div
                        key={`${col}-${row}`}
                        data-cell={`${block.faceId}:${col}:${row}`}
                        onClick={onEmptyCell ? () => onEmptyCell({ faceId: block.faceId, col, row }) : undefined}
                        className={`absolute border border-line-subtle bg-raised ${onEmptyCell ? "cursor-copy" : ""}`}
                        style={{ left: at(r.x), top: at(r.y), width: at(1), height: at(1) }}
                      />
                    );
                  }),
                )}
              </div>
            ))}
            {drawn.map((item) => {
              const block = layout.blocks.find((b) => b.faceId === item.faceId);
              if (!block) return null;
              return (
                <Tile
                  key={item.id}
                  item={item}
                  rect={spanRect(block, item)}
                  selected={item.id === selectedId}
                  highlighted={item.productId === highlightProductId}
                  issue={issues?.get(item.id)}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

type TileProps = { item: GridItem; rect: Rect; selected: boolean; highlighted: boolean; issue: string | undefined; onSelect: (id: string) => void };

function Tile({ item, rect, selected, highlighted, issue, onSelect }: TileProps) {
  // A 1-cell tile has room for the photo and stock only; the name is in the sheet and the card.
  const named = rect.width >= 2;
  return (
    <button
      type="button"
      data-placement={item.id}
      data-marked={selected || highlighted ? "" : undefined}
      data-highlighted={highlighted ? "" : undefined}
      data-issue={issue ? "" : undefined}
      aria-pressed={selected}
      aria-label={`${item.productName}, ${spanLabel(item)}, ${PRESENTATION_LABEL[item.presentation]} ${item.pieceCount}${issue ? `. ${issue}` : ""}`}
      onClick={() => onSelect(item.id)}
      style={placed(rect)}
      className="absolute overflow-hidden rounded-md border border-line bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-marked:ring-3 data-marked:ring-brand data-issue:border-2 data-issue:border-dashed data-issue:border-danger motion-safe:animate-fade-in motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-out-soft) motion-safe:active:scale-[0.97] motion-safe:data-highlighted:animate-tile-pulse"
    >
      <ProductImage productId={item.productId} name={item.productName} categoryName={item.categoryName} imageKey={item.imageKey} size="fill" decorative />
      <span aria-hidden="true" className="absolute top-1 right-1 rounded bg-raised/90 px-1 font-mono text-xs text-ink">
        {item.presentation === "hung" ? "H" : "F"} {item.pieceCount}
      </span>
      {issue ? <AlertTriangle aria-hidden="true" strokeWidth={2} className="absolute top-1 left-1 size-4 text-danger" /> : null}
      {named ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 line-clamp-2 bg-raised/90 px-1 py-0.5 text-center text-xs leading-tight font-medium text-ink">
          {item.productName}
        </span>
      ) : null}
    </button>
  );
}
