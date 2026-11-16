// One placement on the grid: a button with the photo, stock and name. The
// moving tile (selected, and the builder allows it) lifts, takes the pointer
// (touch-action: none on this tile only, so the browser still scrolls and the
// face still swipes everywhere else: DECISIONS 10-11), and grows resize handles
// whose 44 px targets sit outside its edges, so even a half-foot tile can still
// be dragged by its middle. Selected, it also carries the trash and pencil
// discs on its corners (tile-corners.tsx); Delete removes it, Enter or another
// tap opens its panel.
"use client";

import { AlertTriangle, Layers, Shirt } from "lucide-react";
import { useRef } from "react";

import { ProductImage } from "@/components/products/product-image";
import { resizeEdges } from "@/lib/planograms/builder/resize";
import { ROW_UNITS, type Block, type Rect } from "@/lib/planograms/set-grid";
import { viewFor } from "@/lib/products/drawings";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";

import type { GridItem } from "./grid-items";
import { at, KEEP_TOUCH, placed, type Gestures } from "./grid-units";
import { TileCorners, targetSize } from "./tile-corners";
import { TileHandle } from "./tile-handle";

/** A tile sharing rail space with others (hung layers, layers.ts). */
/** `rank` is its place in the group, 0 = front: the depth numbers have gaps (layers.ts). */
export type TileLayer = { rank: number; offsetPx: number };

/** The corner discs' wiring; absent where nothing may be removed or edited. */
export type TileCornerProps = {
  /** Px a unit; 0 until measured. */
  cellPx: number;
  /** The selection came from the keyboard: the discs show with no animation. */
  instant: boolean;
  /** Dragged or resized, or on its way out: no discs. */
  hidden: boolean;
  onRemove: () => void;
  onEdit: () => void;
};

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
  /** `byKeyboard`: a Space or Enter press, not a pointer tap. */
  onSelect: (id: string, byKeyboard: boolean) => void;
  corners?: TileCornerProps;
  /** Removed and fading out; the server hasn't answered yet. */
  leaving?: boolean;
  onKey?: (key: string, shift: boolean) => void;
  onReorder?: (direction: "forward" | "back") => void;
  onEscape?: () => void;
};

export function GridTile({ item, layer = null, block, rect, words, selected, highlighted, issue, movable, offset, held = false, invalid, bounds, gestures, onSelect, corners, leaving = false, onKey, onReorder, onEscape }: GridTileProps) {
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
  const zIndex = layer && !movable ? (selected ? 10 : 9 - Math.min(layer.rank, 8)) : undefined;
  const self = useRef<HTMLButtonElement>(null);
  const edges = resizeEdges(block);
  const grab = movable ? { onPointerDown: gestures.start("move"), ...gestures.handlers, ...KEEP_TOUCH } : {};
  return (
    <>
      <button
        ref={self}
        type="button"
        data-placement={item.id}
        data-marked={selected || highlighted ? "" : undefined}
        data-highlighted={highlighted ? "" : undefined}
        data-issue={issue ? "" : undefined}
        data-lifted={movable ? "" : undefined}
        data-dragging={offset ? "" : undefined}
        data-held={held ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        data-leaving={leaving ? "" : undefined}
        data-layered={layer ? "" : undefined}
        data-rank={layer ? layer.rank : undefined}
        aria-pressed={selected}
        aria-label={`${item.productName}, ${words}, ${PRESENTATION_LABEL[item.presentation]} ${item.pieceCount}${issue ? `. ${issue}` : ""}`}
        onClick={(e) => {
          // A keyboard click (detail 0) is never the end of a drag, even one whose click went elsewhere.
          const wasDrag = gestures.consumeDrag();
          if (e.detail !== 0 && wasDrag) return;
          // Another tap (or Enter) on the selected tile opens its panel.
          if (selected && movable && corners) corners.onEdit();
          else onSelect(item.id, e.detail === 0);
        }}
        onKeyDown={(e) => {
          if (!movable) return;
          if (e.key === "Escape") return onEscape?.();
          // Alt+Up / Alt+Down: Move forward / Move back on a shared rail.
          if (onReorder && e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            return onReorder(e.key === "ArrowUp" ? "forward" : "back");
          }
          if (corners && (e.key === "Delete" || e.key === "Backspace")) {
            e.preventDefault();
            return corners.onRemove();
          }
          if (onKey && e.key.startsWith("Arrow")) {
            e.preventDefault();
            onKey(e.key, e.shiftKey);
          }
        }}
        {...grab}
        style={{ ...placed(rect), transform, zIndex, pointerEvents: passThrough ? "none" : undefined }}
        className="absolute flex flex-col overflow-hidden rounded-md border border-line bg-surface data-layered:border-transparent data-layered:bg-transparent data-layered:hover:outline-1 data-layered:hover:outline-dashed data-layered:hover:outline-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-marked:ring-3 data-marked:ring-brand data-issue:border-2 data-issue:border-dashed data-issue:border-danger data-lifted:z-10 data-lifted:cursor-grab data-lifted:touch-none data-dragging:cursor-grabbing data-invalid:border-2 data-invalid:border-danger motion-safe:animate-fade-in motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-out-soft) motion-safe:active:scale-[0.97] motion-safe:data-highlighted:animate-tile-pulse data-dragging:transition-none data-held:transition-none data-leaving:pointer-events-none motion-safe:data-leaving:animate-tile-out"
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
      {corners ? (
        <TileCorners
          name={item.productName}
          rect={rect}
          bounds={bounds}
          edges={edges}
          cellPx={corners.cellPx}
          shift={shift}
          shown={movable && !corners.hidden}
          instant={corners.instant}
          onRemove={corners.onRemove}
          onEdit={corners.onEdit}
          onEscape={() => {
            self.current?.focus();
            onEscape?.();
          }}
        />
      ) : null}
      {movable && !offset
        ? edges.map((edge) => {
            // Shrunk only where a corner disc would touch it.
            const size = corners ? targetSize(rect, bounds, edges, corners.cellPx) : 44;
            return <TileHandle key={edge} edge={edge} rect={rect} bounds={bounds} gestures={gestures} size={size < 44 ? size : undefined} />;
          })
        : null}
    </>
  );
}
