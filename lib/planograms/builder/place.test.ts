import { describe, expect, it } from "vitest";

import type { Neighbour } from "../rules";
import type { PlanogramFace, ProductFit } from "../types";

import { firstOpenSpot, placeNew } from "./place";

const face = (faceId: string, columns: number, rows: number): PlanogramFace => ({
  faceId, fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: faceId, columns, rows,
});
const front = face("front", 8, 3);
const tableFace: PlanogramFace = { ...face("top", 8, 3), fixtureType: "table" };
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
  it("on a rack hangs first when both fit, else folded, one piece", () => {
    expect(placeNew([front], [], tee)).toEqual({ faceId: "front", presentation: "hung", col: 0, row: 0, colSpan: 2, rowSpan: 3, pieceCount: 1 });
    // The bottom row is taken, so only 2 rows are free: hung (3 tall) can't fit, folded (4 x 2) can.
    expect(placeNew([front], [{ ...blocker("front", 0, 8, 1), row: 2 }], tee)).toEqual({ faceId: "front", presentation: "folded", col: 0, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1 });
    expect(placeNew([front], [blocker("front", 0, 8)], tee)).toBeNull();
  });

  it("on a table folds first when both fit", () => {
    expect(placeNew([tableFace], [], tee)).toEqual({ faceId: "top", presentation: "folded", col: 0, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1 });
  });
});

describe("placeNew on a frame rack", () => {
  it("hangs the product one row high, never folded", async () => {
    const { placeNew } = await import("./place");
    const rail = { faceId: "rail", fixtureId: "r", fixtureName: "Frame rack 1", fixtureType: "frame_rack" as const, side: "front" as const, setSide: null, label: "Frame rack 1", columns: 8, rows: 1 };
    const fit = { id: "p", name: "Pant", styleNumber: "P", footprints: { hung: { columns: 2, rows: 4 }, folded: { columns: 4, rows: 1 } } };
    expect(placeNew([rail], [], fit)).toEqual({ faceId: "rail", col: 0, row: 0, presentation: "hung", colSpan: 2, rowSpan: 1, pieceCount: 1 });
  });
});

describe("placeAt", () => {
  it("puts the product's corner on the tapped cell, folded first on a table", async () => {
    const { placeAt } = await import("./place");
    expect(placeAt([tableFace], [], tee, { faceId: "top", col: 3, row: 1 })).toEqual({ faceId: "top", presentation: "folded", col: 3, row: 1, colSpan: 4, rowSpan: 2, pieceCount: 1 });
  });

  it("hangs first on a rack", async () => {
    const { placeAt } = await import("./place");
    expect(placeAt([front], [], tee, { faceId: "front", col: 3, row: 0 })).toEqual({ faceId: "front", presentation: "hung", col: 3, row: 0, colSpan: 2, rowSpan: 3, pieceCount: 1 });
  });

  it("hangs it when the folded size will not go there but the hung size will", async () => {
    const { placeAt } = await import("./place");
    // Column 6 has 2 columns left to the edge: folded (4 wide) is off the face, hung (2 x 3) fits from row 0.
    expect(placeAt([front], [], tee, { faceId: "front", col: 6, row: 0 })).toEqual({ faceId: "front", presentation: "hung", col: 6, row: 0, colSpan: 2, rowSpan: 3, pieceCount: 1 });
  });

  it("is null when the cell is taken or too near the edge for either size", async () => {
    const { placeAt } = await import("./place");
    expect(placeAt([front], [blocker("front", 0, 8)], tee, { faceId: "front", col: 2, row: 0 })).toBeNull();
    expect(placeAt([front], [], tee, { faceId: "front", col: 7, row: 0 })).toBeNull();
  });

  it("is null for a face it was not given", async () => {
    const { placeAt } = await import("./place");
    expect(placeAt([front], [], tee, { faceId: "elsewhere", col: 0, row: 0 })).toBeNull();
  });

  it("on a frame rack's rail: hung only, one row, whatever row was tapped", async () => {
    const { placeAt } = await import("./place");
    const rail = { faceId: "rail", fixtureId: "r", fixtureName: "Frame rack 1", fixtureType: "frame_rack" as const, side: "front" as const, setSide: null, label: "Frame rack 1", columns: 8, rows: 1 };
    const fit = { id: "p", name: "Pant", styleNumber: "P", footprints: { hung: { columns: 2, rows: 4 }, folded: { columns: 4, rows: 1 } } };
    expect(placeAt([rail], [], fit, { faceId: "rail", col: 3, row: 0 })).toEqual({ faceId: "rail", col: 3, row: 0, presentation: "hung", colSpan: 2, rowSpan: 1, pieceCount: 1 });
  });
});
