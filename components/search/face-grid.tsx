// A fixture face's grid with the product's cells filled (spec §7.3).
// Planogram Detail draws the full grid: components/planograms/planogram-grid.tsx.

import { columnLetters, spanLabel, type Cells } from "@/lib/products/location-label";

const CELL = 10;

export function FaceGrid({ grid, cells, label }: { grid: { columns: number; rows: number }; cells: Cells; label: string }) {
  const covered = (col: number, row: number) =>
    col >= cells.col && col < cells.col + cells.colSpan && row >= cells.row && row < cells.row + cells.rowSpan;
  const width = (grid.columns + 1) * CELL;
  const height = (grid.rows + 1) * CELL;
  const cellRange = spanLabel(cells);

  return (
    <svg
      role="img"
      aria-label={`${label}: cells ${cellRange} of a ${grid.columns} by ${grid.rows} grid`}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-sm"
    >
      {Array.from({ length: grid.columns }, (_, col) => (
        <text key={`c${col}`} x={(col + 1.5) * CELL} y={CELL * 0.7} textAnchor="middle" className="fill-ink-muted text-[4px]">
          {columnLetters(col)}
        </text>
      ))}
      {Array.from({ length: grid.rows }, (_, row) => (
        <text key={`r${row}`} x={CELL * 0.5} y={(row + 1.65) * CELL} textAnchor="middle" className="fill-ink-muted text-[4px]">
          {row + 1}
        </text>
      ))}
      {Array.from({ length: grid.rows }, (_, row) =>
        Array.from({ length: grid.columns }, (_, col) => {
          const isFilled = covered(col, row);
          return (
            <rect
              key={`${col}-${row}`}
              data-filled={isFilled ? "" : undefined}
              x={(col + 1) * CELL}
              y={(row + 1) * CELL}
              width={CELL}
              height={CELL}
              className={isFilled ? "fill-brand stroke-ink" : "fill-raised stroke-line"}
              strokeWidth={0.4}
            />
          );
        }),
      )}
    </svg>
  );
}
