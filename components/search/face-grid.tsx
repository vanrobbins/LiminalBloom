// A fixture face with the product's place filled (spec §7.3), no cell names:
// columns are half a foot, so each is drawn half as wide as a row is tall.
// Planogram Detail draws the full grid: components/planograms/planogram-grid.tsx.

import type { Cells } from "@/lib/products/location-label";

const ROW = 10;
const COL = ROW / 2;

export function FaceGrid({ grid, cells, label }: { grid: { columns: number; rows: number }; cells: Cells; label: string }) {
  const covered = (col: number, row: number) =>
    col >= cells.col && col < cells.col + cells.colSpan && row >= cells.row && row < cells.row + cells.rowSpan;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${grid.columns * COL} ${grid.rows * ROW}`} className="w-full max-w-sm">
      {Array.from({ length: grid.rows }, (_, row) =>
        Array.from({ length: grid.columns }, (_, col) => {
          const isFilled = covered(col, row);
          return (
            <rect
              key={`${col}-${row}`}
              data-filled={isFilled ? "" : undefined}
              x={col * COL}
              y={row * ROW}
              width={COL}
              height={ROW}
              className={isFilled ? "fill-brand stroke-ink" : "fill-raised stroke-line"}
              strokeWidth={0.4}
            />
          );
        }),
      )}
    </svg>
  );
}
