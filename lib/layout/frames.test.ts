import { describe, expect, it } from "vitest";

import { angleTowards, normalizeAngle, rotate, toLocal, toWorld } from "./frames";

describe("rotate", () => {
  it("turns clockwise on the map, where y grows downward", () => {
    // Right turns to down.
    expect(rotate({ x: 1, y: 0 }, 90)).toEqual({ x: 0, y: 1 });
  });

  it("leaves no rounding dust at quarter turns", () => {
    expect(rotate({ x: 3, y: 4 }, 180)).toEqual({ x: -3, y: -4 });
    expect(rotate({ x: 3, y: 4 }, 270)).toEqual({ x: 4, y: -3 });
  });
});

describe("toLocal and toWorld", () => {
  it.each([0, 37, 90, 180, 359])("are inverses at %i°", (rotation) => {
    const pose = { x: 100, y: 50, rotation };
    const p = { x: 133, y: 71 };
    const back = toWorld(pose, toLocal(pose, p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it("puts a fixture's front edge below it at 0° and to its left at 90°", () => {
    expect(toWorld({ x: 0, y: 0, rotation: 0 }, { x: 0, y: 10 })).toEqual({ x: 0, y: 10 });
    expect(toWorld({ x: 0, y: 0, rotation: 90 }, { x: 0, y: 10 })).toEqual({ x: -10, y: 0 });
  });
});

describe("normalizeAngle", () => {
  it("wraps to whole degrees 0–359", () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-15)).toBe(345);
    expect(normalizeAngle(44.6)).toBe(45);
  });
});

describe("angleTowards", () => {
  it("is 0 when the target is straight up and 90 when it is to the right", () => {
    expect(normalizeAngle(angleTowards({ x: 0, y: 0 }, { x: 0, y: -5 }))).toBe(0);
    expect(normalizeAngle(angleTowards({ x: 0, y: 0 }, { x: 5, y: 0 }))).toBe(90);
  });
});
