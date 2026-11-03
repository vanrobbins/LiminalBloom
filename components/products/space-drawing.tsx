// A small drawing of a product's space on the fixture (Week 6.5 spec §3.1):
// a 6 ft wide frame on the half-foot grid, one row taller than the product,
// with the product's block in the top-left corner and its width in feet
// underneath. Decorative: the sentence beside it carries the meaning.

import { COLUMNS_PER_FOOT, feetText } from "@/lib/feet";
import type { Footprint } from "@/lib/products/footprint";

const CELL = 10;
const MIN_COLUMNS = 6 * COLUMNS_PER_FOOT;

export function SpaceDrawing({ footprint }: { footprint: Footprint }) {
  const columns = Math.max(MIN_COLUMNS, footprint.columns);
  const rows = footprint.rows + 1;
  const width = columns * CELL;
  const height = rows * CELL;
  return (
    <figure aria-hidden="true" data-space-drawing className="flex w-full max-w-60 flex-col gap-1">
      <svg viewBox={`-1 -1 ${width + 2} ${height + 2}`} className="w-full" data-columns={footprint.columns} data-rows={footprint.rows}>
        {Array.from({ length: columns + 1 }, (_, i) => (
          <line key={`c${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={height} className="stroke-line" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={`r${i}`} x1={0} y1={i * CELL} x2={width} y2={i * CELL} className="stroke-line" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        ))}
        <rect
          data-block
          x={0}
          y={0}
          width={footprint.columns * CELL}
          height={footprint.rows * CELL}
          className="fill-brand/40 stroke-ink"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="text-sm text-ink-muted">{feetText(footprint.columns)} ft</figcaption>
    </figure>
  );
}
