import { describe, expect, it } from "vitest";

import {
  FIXTURE_RULES,
  corners,
  distanceToRect,
  gridForSurface,
  lowerTablePose,
  mayOverlap,
  rectsOverlap,
  resizeFromHandle,
  resizeLowerTable,
} from "./fixtures";
import type { Fixture } from "./types";

const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  id: "f",
  zoneId: null,
  type: "table",
  name: "Table 1",
  x: 100,
  y: 100,
  width: 72,
  depth: 36,
  rotation: 0,
  tableSetId: null,
  setSide: null,
  version: 0,
  ...over,
});

describe("FIXTURE_RULES", () => {
  it("gives racks four possible sides and tables a top", () => {
    expect(FIXTURE_RULES.rack.faces).toEqual(["front", "back", "left", "right"]);
    expect(FIXTURE_RULES.table.faces).toEqual(["top"]);
    expect(FIXTURE_RULES.mannequin.faces).toEqual([]);
  });
});

describe("corners", () => {
  it("are the rectangle's corners at 0°", () => {
    expect(corners(fixture())).toEqual([
      { x: 64, y: 82 },
      { x: 136, y: 82 },
      { x: 136, y: 118 },
      { x: 64, y: 118 },
    ]);
  });

  it("swap width and depth at 90°", () => {
    const xs = corners(fixture({ rotation: 90 })).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(36);
  });
});

describe("rectsOverlap", () => {
  it("is false for fixtures side by side", () => {
    expect(rectsOverlap(fixture(), fixture({ x: 172 }))).toBe(false);
  });

  it("is true for an inch of overlap", () => {
    expect(rectsOverlap(fixture(), fixture({ x: 171 }))).toBe(true);
  });

  it("sees a rotated fixture's corner poking in", () => {
    // A 24 in square at 45° reaches 12√2 ≈ 16.97 in from its centre: a centre
    // 15 in past the table's right edge pokes about 2 in in.
    const diamond = fixture({ width: 24, depth: 24, rotation: 45, x: 136 + 15, y: 100 });
    expect(rectsOverlap(fixture(), diamond)).toBe(true);
  });

  it("is false for a rotated fixture clear of the edge", () => {
    const diamond = fixture({ width: 24, depth: 24, rotation: 45, x: 136 + 18, y: 100 });
    expect(rectsOverlap(fixture(), diamond)).toBe(false);
  });
});

describe("mayOverlap", () => {
  it("lets a mannequin stand on a platform", () => {
    expect(mayOverlap(fixture({ type: "mannequin" }), fixture({ type: "platform" }), [])).toBe(true);
  });

  it("lets a lower table touch its own upper table", () => {
    const upper = fixture({ id: "u" });
    const lower = fixture({ id: "l", tableSetId: "s", setSide: "front" });
    expect(mayOverlap(upper, lower, [{ id: "s", upperFixtureId: "u", version: 0 }])).toBe(true);
  });

  it("does not excuse two ordinary tables", () => {
    expect(mayOverlap(fixture({ id: "a" }), fixture({ id: "b" }), [])).toBe(false);
  });
});

describe("lowerTablePose", () => {
  it("sits a front lower table below the upper at 0°", () => {
    expect(lowerTablePose(fixture(), "front", 24)).toEqual({ x: 100, y: 100 + 18 + 12, rotation: 0 });
  });

  it("turns side tables a quarter turn", () => {
    expect(lowerTablePose(fixture(), "left", 24)).toEqual({ x: 100 - 36 - 12, y: 100, rotation: 90 });
  });

  it("follows the upper table's rotation", () => {
    // At 90° the upper's front faces −x on the map.
    expect(lowerTablePose(fixture({ rotation: 90 }), "front", 24)).toEqual({
      x: 100 - 30,
      y: 100,
      rotation: 90,
    });
  });
});

describe("resizeFromHandle", () => {
  it("keeps the opposite edge put", () => {
    const next = resizeFromHandle(fixture(), "right", { x: 160, y: 100 });
    expect(next.width).toBe(96);
    expect(next.x - next.width / 2).toBe(64);
  });

  it("works through rotation", () => {
    // At 90° the right edge faces +y.
    const next = resizeFromHandle(fixture({ rotation: 90 }), "right", { x: 100, y: 160 });
    expect(next.width).toBe(96);
    expect(next.y - next.width / 2).toBe(64);
  });

  it("never goes below 1 ft", () => {
    expect(resizeFromHandle(fixture(), "right", { x: 0, y: 100 }).width).toBe(12);
  });
});

describe("resizeLowerTable", () => {
  it("moves both ends together", () => {
    const lower = fixture({ tableSetId: "s", setSide: "front" });
    expect(resizeLowerTable(lower, "right", { x: 150, y: 100 })).toEqual({ width: 100, depth: 36 });
  });
});

describe("distanceToRect", () => {
  it("is 0 inside and the gap outside", () => {
    expect(distanceToRect(fixture(), { x: 100, y: 100 })).toBe(0);
    expect(distanceToRect(fixture(), { x: 146, y: 100 })).toBe(10);
  });
});

describe("gridForSurface", () => {
  it("is a cell per foot, within 1–24", () => {
    expect(gridForSurface(72, 36)).toEqual({ columns: 6, rows: 3 });
    expect(gridForSurface(6, 600)).toEqual({ columns: 1, rows: 24 });
  });
});
