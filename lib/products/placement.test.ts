import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cellsOverlap, firstFreeSpot, fitsGrid, placementIssues } from "./placement";

const grid = { columns: 6, rows: 3 };

describe("placement", () => {
  it("knows when cells fit the grid", () => {
    expect(fitsGrid({ col: 4, row: 1, colSpan: 2, rowSpan: 2 }, grid)).toBe(true);
    expect(fitsGrid({ col: 5, row: 0, colSpan: 2, rowSpan: 1 }, grid)).toBe(false);
    expect(fitsGrid({ col: -1, row: 0, colSpan: 1, rowSpan: 1 }, grid)).toBe(false);
  });

  it("treats touching edges as not overlapping", () => {
    expect(cellsOverlap({ col: 0, row: 0, colSpan: 2, rowSpan: 2 }, { col: 2, row: 0, colSpan: 2, rowSpan: 2 })).toBe(false);
    expect(cellsOverlap({ col: 0, row: 0, colSpan: 2, rowSpan: 2 }, { col: 1, row: 1, colSpan: 2, rowSpan: 2 })).toBe(true);
  });

  it("reports out-of-bounds and overlapping placements", () => {
    const issues = placementIssues(grid, [
      { id: "a", col: 0, row: 0, colSpan: 2, rowSpan: 2 },
      { id: "b", col: 1, row: 1, colSpan: 1, rowSpan: 1 },
      { id: "c", col: 5, row: 2, colSpan: 2, rowSpan: 1 },
    ]);
    expect(issues).toContainEqual({ id: "b", kind: "overlap", otherId: "a" });
    expect(issues).toContainEqual({ id: "c", kind: "out-of-bounds" });
  });

  it("finds the first free spot, row by row", () => {
    expect(firstFreeSpot(grid, [{ col: 0, row: 0, colSpan: 2, rowSpan: 3 }], { columns: 2, rows: 2 })).toEqual({ col: 2, row: 0 });
    expect(firstFreeSpot(grid, [], { columns: 7, rows: 1 })).toBeNull();
  });

  it("never returns a spot that is out of bounds or overlapping", () => {
    const size = fc.record({ columns: fc.integer({ min: 1, max: 4 }), rows: fc.integer({ min: 1, max: 4 }) });
    fc.assert(
      fc.property(fc.array(size, { maxLength: 30 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 8 }), (sizes, columns, rows) => {
        const g = { columns, rows };
        const taken: { col: number; row: number; colSpan: number; rowSpan: number }[] = [];
        for (const s of sizes) {
          const spot = firstFreeSpot(g, taken, s);
          if (spot) taken.push({ ...spot, colSpan: s.columns, rowSpan: s.rows });
        }
        return placementIssues(g, taken.map((c, i) => ({ ...c, id: String(i) }))).length === 0;
      }),
    );
  });
});
