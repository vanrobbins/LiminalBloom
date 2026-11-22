import { describe, expect, it } from "vitest";

import { intersect, selfIntersects } from "./crossings";
import { area, centroid, classify } from "./geometry";
import type { Point } from "./types";

const square = (x: number, y: number, size: number): Point[] => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];

// An L: a 20 × 20 square with its top-right 10 × 10 quarter cut away.
const ell: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 20, y: 10 },
  { x: 20, y: 20 },
  { x: 0, y: 20 },
];

describe("area and centroid", () => {
  it("measures a square either way round", () => {
    expect(area(square(0, 0, 10))).toBe(100);
    expect(area([...square(0, 0, 10)].reverse())).toBe(100);
  });

  it("finds the middle of a square", () => {
    expect(centroid(square(0, 0, 10))).toEqual({ x: 5, y: 5 });
  });
});

describe("classify", () => {
  it("tells inside, outside and on the edge apart", () => {
    expect(classify({ x: 5, y: 5 }, square(0, 0, 10))).toBe("inside");
    expect(classify({ x: 15, y: 5 }, square(0, 0, 10))).toBe("outside");
    expect(classify({ x: 10, y: 5 }, square(0, 0, 10))).toBe("boundary");
    expect(classify({ x: 0, y: 0 }, square(0, 0, 10))).toBe("boundary");
  });

  it("handles the notch of a concave shape", () => {
    expect(classify({ x: 15, y: 5 }, ell)).toBe("outside");
    expect(classify({ x: 15, y: 15 }, ell)).toBe("inside");
  });
});

describe("intersect", () => {
  it("finds a proper crossing", () => {
    const hit = intersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
    expect(hit).toEqual({ kind: "point", at: { x: 5, y: 5 }, proper: true });
  });

  it("treats meeting at an end as touching, not crossing", () => {
    const hit = intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 });
    expect(hit).toMatchObject({ kind: "point", proper: false });
  });

  it("reports the shared part of collinear segments", () => {
    const hit = intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 });
    expect(hit).toEqual({ kind: "overlap", from: { x: 5, y: 0 }, to: { x: 10, y: 0 } });
  });

  it("finds nothing between parallel lines", () => {
    expect(intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toEqual({
      kind: "none",
    });
  });
});

describe("selfIntersects", () => {
  it("accepts simple shapes", () => {
    expect(selfIntersects(square(0, 0, 10))).toBe(false);
    expect(selfIntersects(ell)).toBe(false);
  });

  it("catches a bow tie", () => {
    expect(
      selfIntersects([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    ).toBe(true);
  });

  it("catches an edge folding back on itself", () => {
    expect(
      selfIntersects([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 10 },
      ]),
    ).toBe(true);
  });

  it("catches a repeated corner", () => {
    expect(
      selfIntersects([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    ).toBe(true);
  });
});
