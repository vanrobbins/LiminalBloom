// A planogram's grid (spec §4.1; Part 2 §4): one face, or a table set's
// combined view. HTML, not SVG: every placement is a real button. One unit is
// half a foot on both axes (set-grid.ts), never under 20 px, filling the width;
// a face too wide scrolls sideways with a fade on the clipped edge. No cell
// lines at rest; half-foot guides and a feet ruler appear only while a tile is
// dragged. With a builder, the selected tile drags and resizes: every frame is
// rebuilt from the press's start (lib/planograms/builder), and whether it may
// land is the builder's `check` (rules.ts).

"use client";

import { useRef, useState } from "react";

import { dragTarget } from "@/lib/planograms/builder/drag";
import { resizeTarget } from "@/lib/planograms/builder/resize";
import { spanRect, spotOf, type GridLayout } from "@/lib/planograms/set-grid";
import type { PlacementFields } from "@/lib/planograms/types";
import { shortSpot, spotSummary } from "@/lib/products/location-words";

import { DragChip, DragGuides, DropGhost } from "./drag-guides";
import { SWIPE_MIN_PX } from "./face-swipe";
import { BlockView, GridTile, at } from "./grid-tile";
import type { GridItem } from "./grid-items";
import { useScrollEdges, type Edges } from "./use-scroll-edges";
import { useTileGesture, type Gesture } from "./use-tile-gesture";

/** Room above the grid for a table set's labels, the ruler and the drag chip. */
const GUTTER = "1.5rem";
const OFF_FACE = "Off the edge of the face";

export type GridBuilder = {
  /** The selected tile may be dragged, resized and moved with the arrow keys. */
  canMove: boolean;
  /** Why a tile can't go there (rules.ts words), or null. */
  check: (item: GridItem, fields: PlacementFields) => string | null;
  onCommit: (item: GridItem, fields: PlacementFields, verb: "Moved" | "Resized") => void;
  /** An invalid drop: it has already snapped back; say why. */
  onRefused: (message: string) => void;
  onKey: (item: GridItem, key: string, shift: boolean) => void;
  /** Tap on empty space, or Escape on the selected tile. */
  onEmpty: () => void;
  onDragging: (isDragging: boolean) => void;
};

type PlanogramGridProps = {
  layout: GridLayout;
  items: readonly GridItem[];
  label: string;
  selectedId?: string | null;
  highlightProductId?: string | null;
  issues?: ReadonlyMap<string, string>;
  onSelect: (id: string) => void;
  slideFrom?: "left" | "right" | null;
  onSwipe?: (gesture: { dx: number; dy: number; edges: Edges }) => void;
  builder?: GridBuilder;
};

const sameSpot = (a: PlacementFields, b: PlacementFields) =>
  a.faceId === b.faceId && a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;

export function PlanogramGrid({ layout, items, label, selectedId, highlightProductId, issues, onSelect, slideFrom = null, onSwipe, builder }: PlanogramGridProps) {
  const faceKey = layout.blocks.map((b) => b.faceId).join();
  const { ref, edges } = useScrollEdges<HTMLDivElement>(faceKey);
  const space = useRef<HTMLDivElement>(null);
  // Where a swipe began, and which way the grid could scroll then: a drag that
  // scrolls the grid to its edge doesn't also change face; the next one does.
  const start = useRef<{ x: number; y: number; edges: Edges } | null>(null);
  const [drag, setDrag] = useState<Gesture | null>(null);
  const drawn = items.filter((item) => layout.blocks.some((b) => b.faceId === item.faceId));
  const count = `${drawn.length} ${drawn.length === 1 ? "product" : "products"}`;
  const mask =
    edges.left && edges.right
      ? "linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)"
      : edges.right
        ? "linear-gradient(to right, black calc(100% - 2rem), transparent)"
        : edges.left
          ? "linear-gradient(to left, black calc(100% - 2rem), transparent)"
          : undefined;

  const moving = builder?.canMove ? (drawn.find((i) => i.id === selectedId) ?? null) : null;
  const movingBlock = moving ? (layout.blocks.find((b) => b.faceId === moving.faceId) ?? null) : null;
  function landing(g: Gesture): PlacementFields | null {
    if (!moving || !movingBlock) return null;
    return g.mode === "move" ? dragTarget(layout, moving, g.dx, g.dy) : resizeTarget(movingBlock, moving, g.mode, g.dx, g.dy);
  }
  const target = drag ? landing(drag) : null;
  const targetBlock = target ? (layout.blocks.find((b) => b.faceId === target.faceId) ?? null) : null;
  const refusal = drag && moving ? (target ? (builder?.check(moving, target) ?? null) : OFF_FACE) : null;

  const gestures = useTileGesture({
    unitPx: () => (space.current?.getBoundingClientRect().width ?? 0) / layout.width,
    scroller: () => ref.current,
    onMove: (g) => {
      if (!drag) builder?.onDragging(true);
      setDrag(g);
    },
    onEnd: (g) => {
      setDrag(null);
      builder?.onDragging(false);
      if (!g || !moving || !builder) return;
      const fields = landing(g);
      const reason = fields ? builder.check(moving, fields) : OFF_FACE;
      if (!fields || reason) return builder.onRefused(reason ?? OFF_FACE);
      if (!sameSpot(fields, moving)) builder.onCommit(moving, fields, g.mode === "move" ? "Moved" : "Resized");
    },
  });

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
  const chipAt = target && targetBlock ? spanRect(targetBlock, target) : moving && movingBlock ? spanRect(movingBlock, moving) : null;

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
        // pen use pointer events. The moving tile stops both (Review Focus 1).
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
              "--cell": `max(1.25rem, calc(100cqw / ${layout.width}))`,
              width: at(layout.width),
              height: `calc(${GUTTER} + ${at(layout.height)})`,
            } as React.CSSProperties
          }
        >
          <div ref={space} className="absolute inset-x-0 bottom-0" style={{ top: GUTTER }}>
            {layout.blocks.map((block) => (
              <BlockView key={block.faceId} block={block} labelled={layout.blocks.length > 1} onEmpty={builder?.onEmpty} />
            ))}
            {drag ? <DragGuides layout={layout} /> : null}
            {drag?.mode === "move" && target && targetBlock ? <DropGhost rect={spanRect(targetBlock, target)} invalid={refusal !== null} /> : null}
            {drawn.map((item) => {
              const block = layout.blocks.find((b) => b.faceId === item.faceId);
              if (!block) return null;
              const isMoving = item.id === moving?.id;
              const resized = isMoving && drag && drag.mode !== "move" ? target : null;
              return (
                <GridTile
                  key={item.id}
                  item={item}
                  block={block}
                  rect={spanRect(block, resized ?? item)}
                  words={spotSummary(spotOf(block, item))}
                  selected={item.id === selectedId}
                  highlighted={item.productId === highlightProductId}
                  issue={issues?.get(item.id)}
                  movable={isMoving}
                  offset={isMoving && drag?.mode === "move" ? drag : null}
                  invalid={isMoving && refusal !== null}
                  bounds={layout}
                  gestures={gestures}
                  onSelect={onSelect}
                  onKey={builder && isMoving ? (key, shift) => builder.onKey(item, key, shift) : undefined}
                  onEscape={builder?.onEmpty}
                />
              );
            })}
            {drag && chipAt ? (
              <DragChip rect={chipAt} invalid={refusal !== null} text={refusal ?? (target && targetBlock ? shortSpot(spotOf(targetBlock, target)) : OFF_FACE)} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
