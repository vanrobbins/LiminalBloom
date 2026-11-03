import { describe, expect, it } from "vitest";

import type { Neighbour } from "../rules";
import type { PlanogramFace, ProductFit } from "../types";

import { firstOpenSpot, placeNew } from "./place";

const face = (faceId: string, columns: number, rows: number): PlanogramFace => ({
  faceId, fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: faceId, columns, rows,
});
const front = face("front", 8, 3);
const back = face("back", 8, 3);
const blocker = (faceId: string, col: number, colSpan: number, rowSpan = 3): Neighbour => ({ id: `${faceId}-${col}`, faceId, productName: "X", col, row: 0, colSpan, rowSpan });
const tee: ProductFit = { id: "tee", name: "Pocket Tee", styleNumber: "T", footprints: { folded: { columns: 4, rows: 2 }, hung: { columns: 2, rows: 3 } } };

describe("firstOpenSpot", () => {
  it("takes the first face in order with room, top-left first", () => {
    expect(firstOpenSpot([front, back], [blocker("front", 0, 4)], { colSpan: 4, rowSpan: 2 }, null)).toEqual({ faceId: "front", col: 4, row: 0 });
    expect(firstOpenSpot([front, back], [blocker("front", 0, 8)], { colSpan: 4, rowSpan: 2 }, null)).toEqual({ faceId: "back", col: 0, row: 0 });
  });

  it("ignores the placement being moved", () => {
    expect(firstOpenSpot([front], [blocker("front", 0, 8)], { colSpan: 4, rowSpan: 2 }, "front-0")).toEqual({ faceId: "front", col: 0, row: 0 });
  });

  it("finds nothing when no face has room", () => {
    expect(firstOpenSpot([front], [blocker("front", 0, 8)], { colSpan: 1, rowSpan: 1 }, null)).toBeNull();
  });
});

describe("placeNew", () => {
  it("places folded where it fits, else hung, one piece", () => {
    expect(placeNew([front], [], tee)).toEqual({ faceId: "front", presentation: "folded", col: 0, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1 });
    // Only a 2-column, full-height gap is left: folded (4 wide) can't fit, hung (2 × 3) can.
    expect(placeNew([front], [blocker("front", 0, 6)], tee)).toEqual({ faceId: "front", presentation: "hung", col: 6, row: 0, colSpan: 2, rowSpan: 3, pieceCount: 1 });
    expect(placeNew([front], [blocker("front", 0, 8)], tee)).toBeNull();
  });
});
