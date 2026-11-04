// The landing page's drawn planogram: a 6 ft rack face on the app's half-foot
// grid, with garments drawn as they sit (hung, or folded seen from the front;
// Week 6.5 spec §4.6) and one tile selected in gold. Drawn
// from tokens (fill-*, stroke-*), so it follows the theme and stays sharp at any
// size. Decorative: the caption beside it says the same in words.

import { DRAWINGS, type Shape } from "@/lib/products/drawings";

/** One half-foot column, in drawing units. */
const U = 10;
const COLUMNS = 12;
/** Levels on the rack; each is two half-foot rows tall, as in the app (ROW_UNITS). */
const LEVELS = 3;
const WIDTH = COLUMNS * U;
const HEIGHT = LEVELS * 2 * U;

type Tile = { x: number; y: number; w: number; kind: Shape; view: "hung" | "folded-front"; selected?: boolean };

// Columns and levels, as a planogram stores them. Two columns at the bottom
// right stay open, so the grid shows through.
export const TILES: Tile[] = [
  { x: 0, y: 0, w: 4, kind: "tee", view: "hung" },
  { x: 4, y: 0, w: 4, kind: "tee", view: "hung", selected: true },
  { x: 8, y: 0, w: 4, kind: "knit", view: "hung" },
  { x: 0, y: 1, w: 3, kind: "dress", view: "hung" },
  { x: 3, y: 1, w: 3, kind: "dress", view: "hung" },
  { x: 6, y: 1, w: 6, kind: "outerwear", view: "hung" },
  { x: 0, y: 2, w: 4, kind: "pants", view: "folded-front" },
  { x: 4, y: 2, w: 4, kind: "knit", view: "folded-front" },
  { x: 8, y: 2, w: 2, kind: "bag", view: "folded-front" },
];

const HAIRLINE = { vectorEffect: "non-scaling-stroke" } as const;

export function PlanogramDrawing() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`-4 -14 ${WIDTH + 8} ${HEIGHT + 18}`}
      className="block h-auto w-full"
    >
      <Ruler />
      <rect width={WIDTH} height={HEIGHT} rx={2} className="fill-raised stroke-line" style={HAIRLINE} />
      <Grid />
      {TILES.map((tile) => (
        <TileShape key={`${tile.x}-${tile.y}`} tile={tile} />
      ))}
    </svg>
  );
}

function Ruler() {
  return (
    <g className="stroke-line">
      {Array.from({ length: COLUMNS + 1 }, (_, i) => (
        <line key={i} x1={i * U} x2={i * U} y1={i % 2 ? -3 : -5} y2={-1} style={HAIRLINE} />
      ))}
      {[0, 2, 4, 6].map((foot) => (
        <text
          key={foot}
          x={foot * 2 * U}
          y={-8}
          textAnchor={foot === 0 ? "start" : foot === 6 ? "end" : "middle"}
          className="fill-ink-muted stroke-none font-mono"
          fontSize={5}
        >
          {foot === 6 ? "6 ft" : foot}
        </text>
      ))}
    </g>
  );
}

function Grid() {
  return (
    <g>
      {Array.from({ length: COLUMNS - 1 }, (_, i) => (
        <line key={`c${i}`} x1={(i + 1) * U} x2={(i + 1) * U} y1={0} y2={HEIGHT} className="stroke-line-subtle" style={HAIRLINE} />
      ))}
      {Array.from({ length: LEVELS * 2 - 1 }, (_, i) => {
        // Every second line is a shelf or rail, so it reads stronger.
        const isLevel = i % 2 === 1;
        return (
          <line
            key={`r${i}`}
            x1={0}
            x2={WIDTH}
            y1={(i + 1) * U}
            y2={(i + 1) * U}
            className={isLevel ? "stroke-line" : "stroke-line-subtle"}
            style={HAIRLINE}
          />
        );
      })}
    </g>
  );
}

/** How many pieces fit side by side in a tile this wide, one to three. */
export function pieceCount(columns: number): number {
  return Math.max(1, Math.min(3, Math.floor((columns * U - 4) / 13)));
}

function TileShape({ tile }: { tile: Tile }) {
  const x = tile.x * U + 1;
  const y = tile.y * 2 * U + 1;
  const w = tile.w * U - 2;
  const h = 2 * U - 2;
  const count = pieceCount(tile.w);
  const scale = 14 / 120;
  const step = w / count;
  return (
    <g data-selected={tile.selected ? "" : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={1.5} className="fill-surface stroke-line" style={HAIRLINE} />
      {Array.from({ length: count }, (_, i) => {
        const cx = x + step * (i + 0.5);
        return (
          <path
            key={i}
            d={DRAWINGS[tile.kind][tile.view].body}
            fillRule="evenodd"
            className="fill-ink-muted"
            transform={`translate(${cx - 50 * scale} ${y + (h - 120 * scale) / 2}) scale(${scale})`}
          />
        );
      })}
      {tile.selected ? <Selection x={x} y={y} w={w} h={h} /> : null}
    </g>
  );
}

// The gold ring and the four resize handles the builder shows on a selected tile.
function Selection({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const handles = [
    { cx: x, cy: y + h / 2, bw: 1.4, bh: 6 },
    { cx: x + w, cy: y + h / 2, bw: 1.4, bh: 6 },
    { cx: x + w / 2, cy: y, bw: 6, bh: 1.4 },
    { cx: x + w / 2, cy: y + h, bw: 6, bh: 1.4 },
  ];
  return (
    <>
      <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} rx={2.5} fill="none" strokeWidth={1.6} className="stroke-brand" />
      {handles.map(({ cx, cy, bw, bh }) => (
        <rect
          key={`${cx}-${cy}`}
          x={cx - bw / 2}
          y={cy - bh / 2}
          width={bw}
          height={bh}
          rx={0.7}
          strokeWidth={0.5}
          className="fill-ink stroke-surface"
        />
      ))}
    </>
  );
}
