// A planogram's grid (spec §4.1; Part 2 §4): one face, or a table set's
// combined view. HTML, not SVG: every placement is a real button. One unit is
// half a foot on both axes (set-grid.ts), never under 20 px, filling the width;
// a face too wide scrolls sideways with a fade on the clipped edge. No cell
// lines; half-foot guides and a feet ruler show faint wherever tiles can be moved (a draft, or the latest version)
// and at full strength while a tile is dragged. With a builder, the selected tile drags and resizes: every frame is
// rebuilt from the press's start (lib/planograms/builder), and whether it may
// land is the builder's `check` (rules.ts).

"use client";

import { useRef, useState } from "react";

import { dragTarget } from "@/lib/planograms/builder/drag";
import { layerGroups, layerOffset, layerRanks, sharesSpace } from "@/lib/planograms/layers";
import { resizeTarget } from "@/lib/planograms/builder/resize";
import { spanRect, spotOf, type GridLayout } from "@/lib/planograms/set-grid";
import type { PlacementFields } from "@/lib/planograms/types";
import { shortSpot, spotSummary } from "@/lib/products/location-words";

import { DragChip, DragGuides, DropGhost } from "./drag-guides";
import { BlockView } from "./block-view";
import type { GridBuilder } from "./grid-builder";
import { GridTile } from "./grid-tile";
import { at } from "./grid-units";
import type { GridItem } from "./grid-items";
import { edgeFade, useFaceSwipe } from "./use-face-swipe";
import { useCellPx } from "./use-cell-px";
import { usePendingLanding } from "./use-pending-landing";
import { useEmptyTap } from "./use-empty-tap";
import { useScrollEdges, type Edges } from "./use-scroll-edges";
import { useTileGesture, type Gesture } from "./use-tile-gesture";
import { useTileRemoval } from "./use-tile-removal";

/** Room above the grid for a table set's labels, the ruler and the drag chip. */
const GUTTER = "1.5rem";
const OFF_FACE = "Off the edge of the face";

export type { GridBuilder };

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
  /** A draft is being edited: the guides show (they also show whenever `builder.canMove`). */
  editing?: boolean;
};

const sameSpot = (a: PlacementFields, b: PlacementFields) =>
  a.faceId === b.faceId && a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;

export function PlanogramGrid({ layout, items, label, selectedId, highlightProductId, issues, onSelect, slideFrom = null, onSwipe, builder, editing = false }: PlanogramGridProps) {
  const faceKey = layout.blocks.map((b) => b.faceId).join();
  const { ref, edges } = useScrollEdges<HTMLDivElement>(faceKey);
  const space = useRef<HTMLDivElement>(null);
  const swipe = useFaceSwipe(edges, onSwipe);
  const [drag, setDrag] = useState<Gesture | null>(null);
  const landed = usePendingLanding();
  const cellPx = useCellPx(space, layout.width, faceKey);
  const removal = useTileRemoval(builder?.onRemove, items);
  // A keyboard selection shows the corner discs with no animation.
  const [byKeyboard, setByKeyboard] = useState(false);
  // Each layer group front to back, so Tab meets the front one first; z-index paints them back to front.
  const drawn = layerGroups(landed.draw(items).filter((item) => layout.blocks.some((b) => b.faceId === item.faceId))).flat();
  const ranks = layerRanks(drawn);
  const count = `${drawn.length} ${drawn.length === 1 ? "product" : "products"}`;
  const mask = edgeFade(edges);

  // A tile a Quick Adjust put on the floor isn't in the monthly draft a move would start: it stays put.
  const moving = builder?.canMove ? (drawn.find((i) => i.id === selectedId && !i.adjusted) ?? null) : null;
  const movingBlock = moving ? (layout.blocks.find((b) => b.faceId === moving.faceId) ?? null) : null;
  function landing(g: Gesture): PlacementFields | null {
    if (!moving || !movingBlock) return null;
    return g.mode === "move" ? dragTarget(layout, moving, g.dx, g.dy) : resizeTarget(movingBlock, moving, g.mode, g.dx, g.dy);
  }
  const target = drag ? landing(drag) : null;
  const targetBlock = target ? (layout.blocks.find((b) => b.faceId === target.faceId) ?? null) : null;
  const refusal = drag && moving ? (target ? (builder?.check(moving, target) ?? null) : OFF_FACE) : null;
  // Landing on hung product it didn't share space with: it joins at the back (layers.ts).
  const joining = drag && moving && target && !refusal ? drawn.filter((o) => sharesSpace({ ...target, id: moving.id }, o) && !sharesSpace(moving, o)) : [];
  const behind = joining.length === 0 ? "" : ` · behind ${joining.length === 1 ? joining[0].productName : `${joining.length} others`}`;

  const empty = useEmptyTap({ builder, selected: selectedId != null, layout, space: () => space.current, scroller: () => ref.current });
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
      const verb = g.mode === "move" ? "Moved" : "Resized";
      if (!sameSpot(fields, moving)) landed.hold(moving.id, fields, (onFound) => builder.onCommit(moving, fields, verb, onFound));
    },
  });

  const slide = slideFrom === "right" ? "motion-safe:animate-slide-from-right" : slideFrom === "left" ? "motion-safe:animate-slide-from-left" : "";
  const chipAt = target && targetBlock ? spanRect(targetBlock, target) : moving && movingBlock ? spanRect(movingBlock, moving) : null;

  return (
    <section
      aria-label={`${label}: ${count}`}
      data-planogram-grid
      // Focus lands here when the tile that had it is removed; a tab stop while Enter can add (use-empty-tap.ts).
      {...empty.section}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div
        ref={ref}
        style={{ maskImage: mask }}
        // pr-1 pb-1: room for the ring and focus outline of the last column and row (overflow clips them).
        className="@container overflow-x-auto overscroll-x-contain pr-1 pb-1"
        {...swipe}
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
              <BlockView key={block.faceId} block={block} labelled={layout.blocks.length > 1} empty={empty.block} />
            ))}
            {editing || builder?.canMove || drag ? <DragGuides layout={layout} dragging={drag !== null} /> : null}
            {drag?.mode === "move" && target && targetBlock ? <DropGhost rect={spanRect(targetBlock, target)} invalid={refusal !== null} /> : null}
            {drawn.map((item) => {
              const block = layout.blocks.find((b) => b.faceId === item.faceId);
              if (!block) return null;
              const isMoving = item.id === moving?.id;
              const resized = isMoving && drag && drag.mode !== "move" ? target : null;
              const shared = drawn.some((o) => sharesSpace(item, o));
              return (
                <GridTile
                  key={item.id}
                  item={item}
                  layer={shared ? { rank: ranks.get(item.id) ?? 0, offsetPx: layerOffset(item, drawn) } : null}
                  block={block}
                  rect={spanRect(block, resized ?? item)}
                  words={spotSummary(spotOf(block, item))}
                  selected={item.id === selectedId}
                  highlighted={item.productId === highlightProductId}
                  issue={issues?.get(item.id)}
                  movable={isMoving}
                  offset={isMoving && drag?.mode === "move" ? drag : null}
                  held={landed.isHeld(item.id)}
                  invalid={isMoving && refusal !== null}
                  bounds={layout}
                  gestures={gestures}
                  onSelect={(id, keyboard) => {
                    setByKeyboard(keyboard);
                    onSelect(id);
                  }}
                  leaving={removal.leaving === item.id}
                  corners={
                    builder?.onRemove && builder.onEdit
                      ? { cellPx, instant: byKeyboard, hidden: drag !== null || removal.leaving === item.id, onRemove: () => removal.remove(item), onEdit: () => builder.onEdit?.(item) }
                      : undefined
                  }
                  onKey={
                    builder && isMoving
                      ? (key, shift) => {
                          const nudge = builder.onKey(item, key, shift);
                          if (nudge) landed.hold(item.id, nudge.fields, (onFound) => builder.onCommit(item, nudge.fields, nudge.verb, onFound));
                        }
                      : undefined
                  }
                  onReorder={builder && isMoving ? (direction) => builder.onReorder(item, direction) : undefined}
                  onEscape={builder?.onEmpty}
                />
              );
            })}
            {drag && chipAt ? (
              <DragChip rect={chipAt} invalid={refusal !== null} text={refusal ?? (target && targetBlock ? `${shortSpot(spotOf(targetBlock, target))}${behind}` : OFF_FACE)} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
