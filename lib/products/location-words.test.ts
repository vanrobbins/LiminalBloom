import { describe, expect, it } from "vitest";

import { acrossWord, feetLine, heightWord, placeWords, readCells, shortSpot, spotSummary, type Spot } from "./location-words";

// A face `feet` wide (two columns a foot) with a placement `span` columns wide whose centre is at `centre` columns.
const across = (feet: number, col: number, colSpan: number) => acrossWord(feet * 2, { col, colSpan, row: 0, rowSpan: 1 });
const wall = (over: Partial<Spot> = {}, cells: Partial<Spot["cells"]> = {}): Spot => ({
  fixtureType: "wall_bay", side: "front", columns: 16, rows: 4, presentation: "hung",
  cells: { col: 8, row: 0, colSpan: 4, rowSpan: 1, ...cells }, ...over,
});

describe("acrossWord", () => {
  it("splits a face of 7 ft or more into seven bands, by the placement's centre", () => {
    // 7 ft = 14 columns; a ½ ft placement in each band's middle.
    expect([0, 2, 4, 6, 8, 10, 13].map((col) => across(7, col, 1))).toEqual([
      "Far left", "Left", "Left of center", "Center", "Right of center", "Right", "Far right",
    ]);
  });

  it("uses Left · Center · Right from 3 to 6½ ft", () => {
    expect([0, 6, 11].map((col) => across(6, col, 1))).toEqual(["Left", "Center", "Right"]);
    expect(across(3, 0, 1)).toBe("Left");
    expect(across(6.5, 12, 1)).toBe("Right");
  });

  it("has no word under 3 ft", () => {
    expect(across(2.5, 0, 1)).toBeNull();
  });

  it("says Full width once a placement covers two thirds of the face", () => {
    expect(across(6, 0, 8)).toBe("Full width");
    expect(across(6, 0, 7)).toBe("Left");
  });

  it("puts a centre on a band edge into the band to its right", () => {
    // 6 ft face, centre exactly at 2 ft (4 columns): the Center band.
    expect(across(6, 2, 4)).toBe("Center");
  });
});

describe("heightWord", () => {
  it("names levels by count: none, Top/Bottom, Top/Middle/Bottom, then five bands", () => {
    expect(heightWord(wall({ rows: 1 }))).toBeNull();
    expect([0, 1].map((row) => heightWord(wall({ rows: 2 }, { row })))).toEqual(["Top rail", "Bottom rail"]);
    expect([0, 1, 2].map((row) => heightWord(wall({ rows: 3 }, { row })))).toEqual(["Top rail", "Middle rail", "Bottom rail"]);
    expect([0, 1, 3].map((row) => heightWord(wall({ rows: 4 }, { row })))).toEqual(["Top rail", "Upper rail", "Bottom rail"]);
    expect(heightWord(wall({ rows: 4 }, { row: 1, rowSpan: 2 }))).toBe("Middle rail");
    expect([0, 2, 4].map((row) => heightWord(wall({ rows: 5 }, { row })))).toEqual(["Top rail", "Middle rail", "Bottom rail"]);
  });

  it("says shelf for folded and rail for hung, on wall bays and racks", () => {
    expect(heightWord(wall({ presentation: "folded" }))).toBe("Top shelf");
    expect(heightWord(wall({ fixtureType: "rack", presentation: "hung" }))).toBe("Top rail");
  });

  it("reads a table top front to back, with no noun; row 0 is the back", () => {
    const top = (rows: number, row: number, rowSpan = 1) => heightWord(wall({ fixtureType: "table", side: "top", rows, presentation: "folded" }, { row, rowSpan }));
    expect([0, 1, 2].map((row) => top(3, row))).toEqual(["Back", "Middle", "Front"]);
    expect([0, 1, 2, 3, 4].map((row) => top(5, row))).toEqual(["Back", "Near back", "Middle", "Near front", "Front"]);
    expect(top(1, 0)).toBeNull();
  });

  it("gives other fixture types the word alone", () => {
    expect(heightWord(wall({ fixtureType: "mannequin" }))).toBe("Top");
  });
});

describe("placeWords, feetLine and the short forms", () => {
  it("joins the side-to-side word and the level", () => {
    // 8 ft face (16 columns), centre at 5 columns: the third of seven bands.
    expect(placeWords(wall({}, { col: 4, colSpan: 2 }))).toBe("Left of center · Top rail");
  });

  it("is empty for a narrow single-level face, so the summary falls back to feet", () => {
    const narrow = wall({ columns: 4, rows: 1 }, { col: 1, colSpan: 2 });
    expect(placeWords(narrow)).toBe("");
    expect(spotSummary(narrow)).toBe("½–1½ ft from left · level 1 of 1");
  });

  it("writes feet from the left and levels from the top", () => {
    expect(feetLine(wall({}, { col: 8, colSpan: 4, row: 0 }))).toBe("4–6 ft from left · level 1 of 4");
    expect(feetLine(wall({}, { col: 9, colSpan: 1, row: 1, rowSpan: 3 }))).toBe("4½ ft from left · levels 2–4 of 4");
  });

  it("writes a table top's depth in feet from the back", () => {
    const top = wall({ fixtureType: "table", side: "top", columns: 12, rows: 3, presentation: "folded" }, { col: 0, colSpan: 4, row: 0, rowSpan: 2 });
    expect(feetLine(top)).toBe("0–2 ft from left · 0–2 ft from back");
    expect(placeWords(top)).toBe("Left · Middle");
  });

  it("has a short form for the drag chip", () => {
    expect(shortSpot(wall({ presentation: "folded" }, { col: 8, colSpan: 4 }))).toBe("4–6 ft · Top shelf");
    expect(shortSpot(wall({ rows: 1 }, { col: 9, colSpan: 1 }))).toBe("4½ ft");
  });
});

describe("readCells", () => {
  // A 6 ft lower top (12 columns, 2 rows); a 1 ft placement at the left of the back row.
  const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1 };
  const lower = (setSide: "front" | "back" | "left" | "right" | null) => ({ columns: 12, rows: 2, setSide });

  it("reads a back or right lower table from its outer edge: left and right swap, front and back swap", () => {
    expect(readCells(cells, lower("back"))).toEqual({ col: 10, row: 1, colSpan: 2, rowSpan: 1 });
    expect(readCells(cells, lower("right"))).toEqual({ col: 10, row: 1, colSpan: 2, rowSpan: 1 });
  });

  it("leaves front and left lowers and the fixture's own faces as stored", () => {
    for (const setSide of ["front", "left", null] as const) expect(readCells(cells, lower(setSide))).toEqual(cells);
  });

  it("is its own inverse", () => {
    expect(readCells(readCells(cells, lower("back")), lower("back"))).toEqual(cells);
  });
});
