import { describe, expect, it } from "vitest";

import { buildSnapshot, parseSnapshot } from "./snapshot";
import type { PlacementView, PlanogramFace } from "./types";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const faces: PlanogramFace[] = [
  { faceId: id(1), fixtureId: id(9), fixtureName: "4-way Rack 2", side: "front", setSide: null, label: "Front", columns: 6, rows: 4 },
  { faceId: id(2), fixtureId: id(9), fixtureName: "4-way Rack 2", side: "back", setSide: null, label: "Back", columns: 6, rows: 4 },
];
const view = (over: Partial<PlacementView>): PlacementView => ({
  id: id(5), faceId: id(1), productId: id(7), productName: "Crew Sock", styleNumber: "CS-1", presentation: "hung",
  stackLimit: 12, col: 0, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 6, version: 1, ...over,
});

describe("snapshot", () => {
  it("copies names, sorts by face then position, and round-trips", () => {
    const snapshot = buildSnapshot([view({ faceId: id(2) }), view({ col: 3 }), view({})], faces);
    expect(snapshot.map((e) => [e.faceLabel, e.col])).toEqual([["Front", 0], ["Front", 3], ["Back", 0]]);
    expect(snapshot[0]).toMatchObject({ fixtureName: "4-way Rack 2", productName: "Crew Sock", styleNumber: "CS-1", side: "front", pieceCount: 6 });
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it("refuses a placement on a face outside the planogram", () => {
    expect(() => buildSnapshot([view({ faceId: id(3) })], faces)).toThrow();
  });

  it("rejects malformed history", () => {
    expect(() => parseSnapshot([{ faceId: "x" }])).toThrow();
    expect(() => parseSnapshot({})).toThrow();
    expect(() => parseSnapshot([{ ...buildSnapshot([view({})], faces)[0], col: 30 }])).toThrow();
  });
});
