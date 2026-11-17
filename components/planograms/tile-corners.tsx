// The selected tile's two corner discs (0.7.0.5 spec §2.3; moved 11-17, Van): trash
// on the top-right corner, a bigger pencil inside the bottom-right. Each is a 44 px
// `Button icon` above the neighbours. The trash's 28 px disc is centred on its
// corner; on a tile under 88 px it sits fully outside, and on any of the drawing
// space's four edges (clipped there) it turns inward, the rule tile-handle.tsx uses.
// The pencil's 36 px disc sits inside the tile's corner; a tile under 88 px has no
// room, so there it falls back to the trash's rule (outside, inward at an edge).
// Where a disc would touch a resize handle both shrink together, never under 24 px.
// They follow the tile's layer offset, fade in over 120 ms and out over 90 ms (none
// for a keyboard move or reduced motion), and come after the tile in the tab order:
// tile, trash, pencil.

"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Edge } from "@/lib/planograms/builder/resize";
import type { Rect } from "@/lib/planograms/set-grid";

import { at, KEEP_TOUCH } from "./grid-units";
import { handleBox } from "./tile-handle";

const TARGET = 44;
/** Each disc's drawn size; the pencil, the more used, is the bigger one. */
const DISC = { trash: 28, pencil: 36 } as const;
const MIN_TARGET = 24;
/** Under this many px on either axis the discs go fully outside. */
const ROOMY = 88;
/** --duration-exit (globals.css): how long a leaving disc stays drawn. */
const EXIT_MS = 90;

type Bounds = { width: number; height: number };
type Axis = "in" | "out" | "mid";
// Where the target's top-left sits from its corner, in target sizes, on a side of the tile that is
// low (left, top: outward is negative) or high (right, bottom).
const SIDE: Record<"low" | "high", Record<Axis, number>> = { low: { out: -1, mid: -0.5, in: 0 }, high: { out: 0, mid: -0.5, in: -1 } };
// Trash on the top-right corner, pencil on the bottom-right.
const FROM = {
  trash: { x: SIDE.high, y: SIDE.low },
  pencil: { x: SIDE.high, y: SIDE.high },
} as const;

/** Per axis: inward on the grid's edge, else outside on a small tile, else centred on the corner (trash) or inside it (pencil). */
function placesOf(rect: Rect, bounds: Bounds, cellPx: number) {
  const small = cellPx > 0 && (rect.width * cellPx < ROOMY || rect.height * cellPx < ROOMY);
  const pick = (atEdge: boolean): Axis => (atEdge ? "in" : small ? "out" : "mid");
  const right = rect.x + rect.width >= bounds.width;
  return {
    trash: { x: pick(right), y: pick(rect.y <= 0) },
    pencil: small ? { x: pick(right), y: pick(rect.y + rect.height >= bounds.height) } : { x: "in" as Axis, y: "in" as Axis },
  };
}

/** The side of the corner and handle targets: 44 px, or the largest even size down to 24 px at which none touch. */
export function targetSize(rect: Rect, bounds: Bounds, edges: readonly Edge[], cellPx: number): number {
  if (cellPx <= 0) return TARGET;
  const places = placesOf(rect, bounds, cellPx);
  for (let size = TARGET; size > MIN_TARGET; size -= 2) {
    const boxes = [
      { x: (rect.x + rect.width) * cellPx + FROM.trash.x[places.trash.x] * size, y: rect.y * cellPx + FROM.trash.y[places.trash.y] * size, size },
      { x: (rect.x + rect.width) * cellPx + FROM.pencil.x[places.pencil.x] * size, y: (rect.y + rect.height) * cellPx + FROM.pencil.y[places.pencil.y] * size, size },
      ...edges.map((edge) => handleBox(edge, rect, bounds, size, cellPx)),
    ];
    const touching = boxes.some((a, i) => boxes.slice(i + 1).some((b) => a.x < b.x + b.size && b.x < a.x + a.size && a.y < b.y + b.size && b.y < a.y + a.size));
    if (!touching) return size;
  }
  return MIN_TARGET;
}

/** True while `on`, and for `ms` after it goes off, so a leaving thing can play its exit. */
function useLinger(on: boolean, ms: number): boolean {
  const [lingering, setLingering] = useState(false);
  const [was, setWas] = useState(on);
  if (was !== on) {
    setWas(on);
    setLingering(!on && ms > 0);
  }
  useEffect(() => {
    if (!lingering) return;
    const timer = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(timer);
  }, [lingering, ms]);
  return on || lingering;
}

type TileCornersProps = {
  name: string;
  rect: Rect;
  bounds: Bounds;
  /** The edges it can be resized from: their handles are what the discs keep clear of. */
  edges: readonly Edge[];
  /** Px a unit; 0 until measured. */
  cellPx: number;
  /** A layered tile is drawn this many px right and up (layers.ts). */
  shift?: number;
  /** Selected, and not being dragged or removed. */
  shown: boolean;
  /** The selection moved by keyboard: no animation (high frequency). */
  instant?: boolean;
  onRemove: () => void;
  onEdit: () => void;
  onEscape: () => void;
};

export function TileCorners({ name, rect, bounds, edges, cellPx, shift = 0, shown, instant = false, onRemove, onEdit, onEscape }: TileCornersProps) {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const present = useLinger(shown, instant || reduced ? 0 : EXIT_MS);
  if (!present) return null;
  const size = targetSize(rect, bounds, edges, cellPx);
  const places = placesOf(rect, bounds, cellPx);
  const motion = instant ? "" : shown ? "motion-safe:animate-disc-in" : "motion-safe:animate-disc-out";
  const corners = [
    { which: "trash", label: `Remove ${name}`, Icon: Trash2, tone: "text-danger", at: { x: rect.x + rect.width, y: rect.y }, act: onRemove },
    { which: "pencil", label: `Edit ${name}`, Icon: Pencil, tone: "text-ink", at: { x: rect.x + rect.width, y: rect.y + rect.height }, act: onEdit },
  ] as const;
  return (
    <>
      {corners.map(({ which, label, Icon, tone, at: corner, act }) => {
        const place = places[which];
        const fx = FROM[which].x[place.x];
        const fy = FROM[which].y[place.y];
        const disc = Math.min(DISC[which], size);
        return (
          <Button
            key={which}
            icon
            variant="ghost"
            aria-label={label}
            data-corner={which}
            data-x={place.x}
            data-y={place.y}
            // Leaving: still drawn for its exit, out of the tab order and the accessibility tree.
            inert={!shown}
            aria-hidden={!shown || undefined}
            onClick={act}
            {...KEEP_TOUCH}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEscape();
            }}
            style={{
              left: `calc(${at(corner.x)} + ${fx * size + shift}px)`,
              top: `calc(${at(corner.y)} + ${fy * size - shift}px)`,
              width: size,
              height: size,
              minHeight: size,
              // The animation grows from the tile's corner, which sits at -fx, -fy of the target.
              transformOrigin: `${-fx * 100}% ${-fy * 100}%`,
            }}
            className={`absolute z-30 touch-manipulation ${shown ? "" : "pointer-events-none"} ${motion}`}
          >
            <span
              style={{ width: disc, height: disc }}
              className={`pointer-events-none flex items-center justify-center rounded-full border border-line bg-raised shadow-sm ${tone}`}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className={which === "pencil" && disc > 28 ? "size-5" : "size-4"} />
            </span>
          </Button>
        );
      })}
    </>
  );
}
