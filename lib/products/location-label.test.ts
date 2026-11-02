import { describe, expect, it } from "vitest";

import { locationDetail, locationLabel, type LocationParts } from "./location-label";

const floor = (over: Partial<Extract<LocationParts, { kind: "floor" }>> = {}): LocationParts => ({
  kind: "floor", fixtureName: "Wall bay 3", faceCount: 1, fixtureType: "wall_bay", side: "front", columns: 16, rows: 4,
  presentation: "hung", cells: { col: 4, row: 0, colSpan: 2, rowSpan: 1 }, ...over,
});

describe("location labels", () => {
  it("reads fixture, side to side and level in words", () => {
    expect(locationLabel(floor())).toBe("Wall bay 3 · Left of center · Top rail");
    expect(locationDetail(floor())).toBe("2–3 ft from left · level 1 of 4");
  });

  it("names the side only when the fixture has more than one face", () => {
    expect(locationLabel(floor({ fixtureName: "Rack 1", fixtureType: "rack", side: "back", faceCount: 2 }))).toBe("Rack 1 · Back · Left of center · Top rail");
  });

  it("is just the fixture when no words apply", () => {
    expect(locationLabel(floor({ columns: 4, rows: 1, cells: { col: 0, row: 0, colSpan: 2, rowSpan: 1 } }))).toBe("Wall bay 3");
  });

  it("names a stockroom bin, with no second line", () => {
    expect(locationLabel({ kind: "bin", code: "B-12" })).toBe("Stockroom, bin B-12");
    expect(locationDetail({ kind: "bin", code: "B-12" })).toBe("");
  });
});
