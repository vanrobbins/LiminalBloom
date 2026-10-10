import { describe, expect, it } from "vitest";

import { cellLabel } from "@/lib/products/location-label";

import { parseCell } from "./cells";

describe("parseCell", () => {
  it("reads a column letter and a row number", () => {
    expect(parseCell("A1")).toEqual({ col: 0, row: 0 });
    expect(parseCell("d12")).toEqual({ col: 3, row: 11 });
    expect(parseCell("  B2 ")).toEqual({ col: 1, row: 1 });
  });

  it("round-trips with cellLabel", () => {
    for (const [col, row] of [[0, 0], [5, 2], [23, 23], [26, 0]]) {
      expect(parseCell(cellLabel(col, row))).toEqual({ col, row });
    }
  });

  it("refuses anything that is not a cell name", () => {
    for (const text of ["", "A", "1", "A0", "1A", "A-1", "A 1", "A100", "Ä1"]) {
      expect(parseCell(text)).toBeNull();
    }
  });
});
