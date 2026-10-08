import { describe, expect, it } from "vitest";

import { cellLabel, columnLetters, locationLabel, spanLabel } from "./location-label";

describe("location labels", () => {
  it("letters columns like a spreadsheet", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(columnLetters)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
  });

  it("numbers rows from 1", () => {
    expect(cellLabel(0, 3)).toBe("A4");
  });

  it("shows a span only when it covers more than one cell", () => {
    expect(spanLabel({ col: 0, row: 3, colSpan: 1, rowSpan: 1 })).toBe("A4");
    expect(spanLabel({ col: 0, row: 3, colSpan: 2, rowSpan: 2 })).toBe("A4–B5");
  });

  it("names the side only when the fixture has more than one face", () => {
    const cells = { col: 0, row: 3, colSpan: 2, rowSpan: 1 };
    expect(locationLabel({ kind: "floor", fixtureName: "Wall bay 3", side: "front", faceCount: 1, cells })).toBe("Wall bay 3, A4");
    expect(locationLabel({ kind: "floor", fixtureName: "Front table 2", side: "front", faceCount: 2, cells: { ...cells, row: 0 } })).toBe("Front table 2, Front, A1");
    expect(locationLabel({ kind: "floor", fixtureName: "Rack 1", side: "back", faceCount: 2, cells }, { span: true })).toBe("Rack 1, Back, A4–B4");
  });

  it("names a stockroom bin", () => {
    expect(locationLabel({ kind: "bin", code: "B-12" })).toBe("Stockroom, bin B-12");
  });
});
