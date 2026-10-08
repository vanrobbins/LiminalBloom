// The two rules every placement keeps (§1.5: "the builder blocks every
// overlapping or out-of-bounds placement"): inside the face's grid, and not on
// top of another product. Pure, so the seed uses it now and the Week 5 builder
// uses the same code later. Hung stacking (several styles on one hook) is a
// Week 5 exception and is not allowed here.

import type { Cells } from "./location-label";

export type Grid = { columns: number; rows: number };

export type PlacementIssue = { id: string; kind: "out-of-bounds" | "overlap"; otherId?: string };

export function fitsGrid(c: Cells, grid: Grid): boolean {
  return (
    c.col >= 0 &&
    c.row >= 0 &&
    c.colSpan >= 1 &&
    c.rowSpan >= 1 &&
    c.col + c.colSpan <= grid.columns &&
    c.row + c.rowSpan <= grid.rows
  );
}

/** Half-open ranges: cells that only share an edge do not overlap. */
export function cellsOverlap(a: Cells, b: Cells): boolean {
  return a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
}

export function placementIssues(grid: Grid, placements: readonly (Cells & { id: string })[]): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  placements.forEach((p, i) => {
    if (!fitsGrid(p, grid)) issues.push({ id: p.id, kind: "out-of-bounds" });
    for (const earlier of placements.slice(0, i)) {
      if (cellsOverlap(p, earlier)) issues.push({ id: p.id, kind: "overlap", otherId: earlier.id });
    }
  });
  return issues;
}

export function firstFreeSpot(
  grid: Grid,
  taken: readonly Cells[],
  size: { columns: number; rows: number },
): { col: number; row: number } | null {
  for (let row = 0; row + size.rows <= grid.rows; row++) {
    for (let col = 0; col + size.columns <= grid.columns; col++) {
      const candidate = { col, row, colSpan: size.columns, rowSpan: size.rows };
      if (!taken.some((t) => cellsOverlap(candidate, t))) return { col, row };
    }
  }
  return null;
}
