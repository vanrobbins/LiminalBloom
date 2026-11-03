// One fixture face as a grid of half-foot columns. Read-only, it shows where
// things are (a found product outlined in gold). Editable, a tile is selected
// by tap or Enter, dragged to move, or moved a step with the arrow keys; while
// dragging, the outline turns to a dashed brick edge where the drop won't fit.

"use client";

import { checkSpot } from "@/lib/demo/grid";
import type { Face, Placement, Product } from "@/lib/demo/types";

import { FOCUS, TINT } from "./looks";
import { useTileDrag } from "./use-tile-drag";

type FaceGridProps = {
  face: Face;
  placements: Placement[];
  products: Product[];
  /** Outlined in gold: the product someone is looking for, or the selection. */
  markedId?: string | null;
  editable?: boolean;
  onSelect?: (placementId: string) => void;
  onMove?: (placementId: string, col: number, row: number) => void;
  rowHeight?: string;
};

export function FaceGrid({ face, placements, products, markedId, editable = false, onSelect, onMove, rowHeight = "2.75rem" }: FaceGridProps) {
  const onFace = placements.filter((p) => p.faceId === face.id);
  const { grid, target, press } = useTileDrag({
    cols: face.cols,
    rows: face.rows,
    onTap: (id) => onSelect?.(id),
    onDrop: ({ id, col, row }) => onMove?.(id, col, row),
  });
  const moving = target ? onFace.find((p) => p.id === target.id) : undefined;
  const ghostFits =
    moving && target ? checkSpot(face, onFace.filter((p) => p.id !== moving.id), { faceId: face.id, col: target.col, row: target.row, w: moving.w, h: moving.h }).ok : false;

  function onKey(event: React.KeyboardEvent, placement: Placement) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step || !editable || placement.id !== markedId) return;
    event.preventDefault();
    onMove?.(placement.id, placement.col + step[0], placement.row + step[1]);
  }

  return (
    <div
      ref={grid}
      className={`relative grid gap-0.5 rounded border border-line bg-line-subtle p-0.5 select-none ${editable ? "touch-none" : ""}`}
      style={{ gridTemplateColumns: `repeat(${face.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${face.rows}, ${rowHeight})` }}
    >
      {Array.from({ length: face.cols * face.rows }, (_, i) => (
        <span key={i} className="rounded-sm bg-surface" style={{ gridColumn: (i % face.cols) + 1, gridRow: Math.floor(i / face.cols) + 1 }} />
      ))}
      {onFace.map((placement) => {
        const product = products.find((p) => p.id === placement.productId);
        if (!product) return null;
        const isSoldOut = product.status === "sold_out";
        const isMarked = placement.id === markedId || placement.productId === markedId;
        const look = isSoldOut ? "border border-dashed border-danger bg-danger-tint text-danger" : `text-ink ${TINT[product.tone]}`;
        const label = `${product.name}${isSoldOut ? ", sold out" : ""}${placement.adjusted ? ", adjusted" : ""}`;
        const body = (
          <>
            <span className="line-clamp-2">{isSoldOut ? `Sold out: ${product.name}` : product.name}</span>
            {placement.adjusted ? <span aria-hidden="true" className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-ink" /> : null}
          </>
        );
        const place = { gridColumn: `${placement.col + 1} / span ${placement.w}`, gridRow: `${placement.row + 1} / span ${placement.h}` };
        const classes = `relative flex items-center justify-center overflow-hidden rounded-sm px-0.5 text-center text-[0.625rem] leading-tight font-medium ${look} ${isMarked ? "outline-2 outline-offset-1 outline-brand" : ""} ${target?.id === placement.id ? "opacity-50" : ""}`;
        return onSelect ? (
          <button
            key={placement.id}
            type="button"
            aria-label={label}
            aria-pressed={isMarked}
            onKeyDown={(event) => onKey(event, placement)}
            {...(editable ? press(placement.id, placement.col, placement.row) : { onClick: () => onSelect(placement.id) })}
            className={`${classes} ${editable ? "cursor-grab" : ""} ${FOCUS}`}
            style={place}
          >
            {body}
          </button>
        ) : (
          <span key={placement.id} className={classes} style={place} title={label}>
            {body}
          </span>
        );
      })}
      {moving && target ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none rounded-sm border-2 ${ghostFits ? "border-brand bg-brand/20" : "border-dashed border-danger bg-danger-tint/60"}`}
          style={{
            // Kept inside the grid, so an off-edge drag can't add columns; it shows refused.
            gridColumn: `${Math.min(Math.max(target.col, 0), face.cols - moving.w) + 1} / span ${moving.w}`,
            gridRow: `${Math.min(Math.max(target.row, 0), face.rows - moving.h) + 1} / span ${moving.h}`,
          }}
        />
      ) : null}
    </div>
  );
}
