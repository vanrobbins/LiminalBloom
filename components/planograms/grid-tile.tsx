// One placement on the grid, and one face's surface beneath the tiles. A tile
// is a button with the photo, stock and name. The moving tile (selected, and
// the builder allows it) lifts, takes the pointer (touch-action: none on this
// tile only, so the browser still scrolls and the face still swipes everywhere
// else: DECISIONS 10-11), and grows resize handles whose 44 px targets sit
// outside its edges, so even a half-foot tile can still be dragged by its middle.

"use client";

import { AlertTriangle, Layers, Shirt } from "lucide-react";

import { ProductImage } from "@/components/products/product-image";
import { resizeEdges, type Edge } from "@/lib/planograms/builder/resize";
import { ROW_UNITS, type Block, type Rect } from "@/lib/planograms/set-grid";
import { viewFor } from "@/lib/products/drawings";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";

import type { GridItem } from "./grid-items";
import type { useTileGesture } from "./use-tile-gesture";

export const at = (n: number) => `calc(var(--cell) * ${n})`;
/** A tile sits 1 px inside its space, so neighbours read as separate. */
export const placed = (r: Rect): React.CSSProperties => ({
  left: `calc(${at(r.x)} + 1px)`,
  top: `calc(${at(r.y)} + 1px)`,
  width: `calc(${at(r.width)} - 2px)`,
  height: `calc(${at(r.height)} - 2px)`,
});

type Gestures = ReturnType<typeof useTileGesture>;

// A touch on the moving tile is the tile's alone (Review Focus 1).
const KEEP_TOUCH = {
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  onTouchEnd: (e: React.TouchEvent) => e.stopPropagation(),
};

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
          {block.label}
        </span>
      ) : null}
      {Array.from({ length: rules }, (_, i) => (
        <span key={i} aria-hidden="true" data-level-rule className="absolute inset-x-0 border-t border-line-subtle" style={{ top: at((i + 1) * ROW_UNITS) }} />
      ))}
    </div>
  );
}

/** A tile sharing rail space with others (hung layers, layers.ts). */
export type TileLayer = { depth: number; offsetPx: number };

type GridTileProps = {
  item: GridItem;
  /** Shares rail space: no card, so the one behind shows; drawn up and right by its offset; clicks land on the garment. */
  layer?: TileLayer | null;
  block: Block;
  rect: Rect;
  words: string;
  selected: boolean;
  highlighted: boolean;
  issue: string | undefined;
  /** Selected and movable: lifted, with handles. */
  movable: boolean;
  /** How far it follows the pointer, in units, while moved. */
  offset: { dx: number; dy: number } | null;
  /** Dropped and waiting on its save: it sits still where it landed instead of sliding back from the pointer, but is out of the hand, handles and all (B10). */
  held?: boolean;
  invalid: boolean;
  /** The drawing space's size, in units: a handle at its edge turns inward. */
  bounds: { width: number; height: number };
  gestures: Gestures;
  onSelect: (id: string) => void;
  onKey?: (key: string, shift: boolean) => void;
  onReorder?: (direction: "forward" | "back") => void;
  onEscape?: () => void;
};

export function GridTile({ item, layer = null, block, rect, words, selected, highlighted, issue, movable, offset, held = false, invalid, bounds, gestures, onSelect, onKey, onReorder, onEscape }: GridTileProps) {
  // Under 2 ft wide there is room for the photo and stock only; the name is in the sheet and the card.
  // Sharing a rail, the name strip would hide the product behind: its name is in the label and the Layers list.
  const named = rect.width >= 2 * ROW_UNITS && !layer;
  // A shared tile takes the pointer only where its garment (or photo, or badge) is painted, so a click
  // lands on what shows; selected, it rises to the top and takes its whole box, so it can be dragged.
  const passThrough = layer !== null && !selected && !movable;
  const shift = layer?.offsetPx ?? 0;
  const moveX = offset ? at(offset.dx) : "0px";
  const moveY = offset ? at(offset.dy) : "0px";
  const transform = offset || shift ? `translate(calc(${moveX} + ${shift}px), calc(${moveY} - ${shift}px))` : undefined;
  // Back to front: nearer the front paints over; the selected one above all (lifted tiles are z-10).
  const zIndex = layer && !movable ? (selected ? 10 : 9 - Math.min(layer.depth, 8)) : undefined;
  const grab = movable ? { onPointerDown: gestures.start("move"), ...gestures.handlers, ...KEEP_TOUCH } : {};
  return (
    <>
      <button
        type="button"
        data-placement={item.id}
        data-marked={selected || highlighted ? "" : undefined}
        data-highlighted={highlighted ? "" : undefined}
        data-issue={issue ? "" : undefined}
        data-lifted={movable ? "" : undefined}
        data-dragging={offset ? "" : undefined}
        data-held={held ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        data-layered={layer ? "" : undefined}
        data-depth={layer ? layer.depth : undefined}
        aria-pressed={selected}
        aria-label={`${item.productName}, ${words}, ${PRESENTATION_LABEL[item.presentation]} ${item.pieceCount}${issue ? `. ${issue}` : ""}`}
        onClick={(e) => {
          // A keyboard click (detail 0) is never the end of a drag, even one whose click went elsewhere.
          const wasDrag = gestures.consumeDrag();
          if (e.detail === 0 || !wasDrag) onSelect(item.id);
        }}
        onKeyDown={(e) => {
          if (!movable) return;
          if (e.key === "Escape") return onEscape?.();
          // Alt+Up / Alt+Down: Move forward / Move back on a shared rail.
          if (onReorder && e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            return onReorder(e.key === "ArrowUp" ? "forward" : "back");
          }
          if (onKey && e.key.startsWith("Arrow")) {
            e.preventDefault();
            onKey(e.key, e.shiftKey);
          }
        }}
        {...grab}
        style={{ ...placed(rect), transform, zIndex, pointerEvents: passThrough ? "none" : undefined }}
        className="absolute flex flex-col overflow-hidden rounded-md border border-line bg-surface data-layered:border-transparent data-layered:bg-transparent data-layered:hover:outline-1 data-layered:hover:outline-dashed data-layered:hover:outline-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-marked:ring-3 data-marked:ring-brand data-issue:border-2 data-issue:border-dashed data-issue:border-danger data-lifted:z-10 data-lifted:cursor-grab data-lifted:touch-none data-dragging:cursor-grabbing data-invalid:border-2 data-invalid:border-danger motion-safe:animate-fade-in motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-out-soft) motion-safe:active:scale-[0.97] motion-safe:data-highlighted:animate-tile-pulse data-dragging:transition-none data-held:transition-none"
      >
        <span className={`min-h-0 w-full flex-1 ${passThrough ? "[&_img]:pointer-events-auto [&_path]:pointer-events-auto [&_rect]:pointer-events-auto" : ""}`}>
          <ProductImage
            productId={item.productId}
            name={item.productName}
            categoryName={item.categoryName}
            imageKey={item.imageKey}
            view={viewFor(item.presentation, block.side)}
            swatch={item.swatch}
            texture={item.texture}
            colorWord={item.colorWord}
            size="fill"
            decorative
            clear={layer !== null}
          />
        </span>
        {/* An icon for hung or folded and the piece count, not "F 1" (UX audit U21); the words are in the label and on hover. */}
        <span
          aria-hidden="true"
          data-count-badge
          title={`${PRESENTATION_LABEL[item.presentation]} · ${item.pieceCount} ${item.pieceCount === 1 ? "piece" : "pieces"}`}
          className="pointer-events-auto absolute top-1 right-1 inline-flex items-center gap-0.5 rounded bg-raised/90 px-1 text-xs text-ink"
        >
          {item.presentation === "hung" ? <Shirt strokeWidth={1.75} className="size-3" /> : <Layers strokeWidth={1.75} className="size-3" />}
          {item.pieceCount}
        </span>
        {issue ? <AlertTriangle aria-hidden="true" strokeWidth={2} className="absolute top-1 left-1 size-4 text-danger" /> : null}
        {named ? (
          // Under the drawing, not over it (UX audit U21).
          <span aria-hidden="true" className="line-clamp-2 shrink-0 border-t border-line-subtle bg-raised px-1 py-0.5 text-center text-xs leading-tight font-medium text-ink">
            {item.productName}
          </span>
        ) : null}
      </button>
      {movable && !offset ? resizeEdges(block).map((edge) => <Handle key={edge} edge={edge} rect={rect} bounds={bounds} gestures={gestures} />) : null}
    </>
  );
}

// Each handle's 44 px target sits just outside its edge, the visible bar on the
// edge. Where that edge is the drawing space's own, outside would be clipped or
// add scroll, so the target turns inward over the tile (the bar stays on the edge).
type Place = { shift: string; align: string };
type HandleSpec = { at: (r: Rect) => [number, number]; atBound: (r: Rect, b: { width: number; height: number }) => boolean; out: Place; in: Place; cursor: string; bar: string };
const HANDLE: Record<Edge, HandleSpec> = {
  left: {
    at: (r) => [r.x, r.y + r.height / 2],
    atBound: (r) => r.x <= 0,
    out: { shift: "translate(-100%, -50%)", align: "items-center justify-end" },
    in: { shift: "translate(0, -50%)", align: "items-center justify-start" },
    cursor: "cursor-ew-resize",
    bar: "h-5 w-1.5",
  },
  right: {
    at: (r) => [r.x + r.width, r.y + r.height / 2],
    atBound: (r, b) => r.x + r.width >= b.width,
    out: { shift: "translate(0, -50%)", align: "items-center justify-start" },
    in: { shift: "translate(-100%, -50%)", align: "items-center justify-end" },
    cursor: "cursor-ew-resize",
    bar: "h-5 w-1.5",
  },
  top: {
    at: (r) => [r.x + r.width / 2, r.y],
    atBound: (r) => r.y <= 0,
    out: { shift: "translate(-50%, -100%)", align: "items-end justify-center" },
    in: { shift: "translate(-50%, 0)", align: "items-start justify-center" },
    cursor: "cursor-ns-resize",
    bar: "h-1.5 w-5",
  },
  bottom: {
    at: (r) => [r.x + r.width / 2, r.y + r.height],
    atBound: (r, b) => r.y + r.height >= b.height,
    out: { shift: "translate(-50%, 0)", align: "items-start justify-center" },
    in: { shift: "translate(-50%, -100%)", align: "items-end justify-center" },
    cursor: "cursor-ns-resize",
    bar: "h-1.5 w-5",
  },
};

function Handle({ edge, rect, bounds, gestures }: { edge: Edge; rect: Rect; bounds: { width: number; height: number }; gestures: Gestures }) {
  const h = HANDLE[edge];
  const [x, y] = h.at(rect);
  const inward = h.atBound(rect, bounds);
  const place = inward ? h.in : h.out;
  return (
    // Shift+arrows resize from the keyboard; the handle is for pointers only.
    <div
      aria-hidden="true"
      data-handle={edge}
      data-inward={inward ? "" : undefined}
      onPointerDown={gestures.start(edge)}
      {...gestures.handlers}
      {...KEEP_TOUCH}
      className={`absolute z-20 flex size-11 touch-none ${place.align} ${h.cursor}`}
      style={{ left: at(x), top: at(y), transform: place.shift }}
    >
      <span className={`rounded-full border border-surface bg-ink ${h.bar}`} />
    </div>
  );
}
