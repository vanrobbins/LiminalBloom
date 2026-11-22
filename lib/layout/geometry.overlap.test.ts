import { describe, expect, it } from "vitest";

import { polygonsOverlap } from "./crossings";

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

describe("polygonsOverlap", () => {
  it("is false for shapes apart", () => {
    expect(polygonsOverlap(square(0, 0, 10), square(20, 0, 10))).toBe(false);
  });

  it("is false for shapes sharing an edge", () => {
    expect(polygonsOverlap(square(0, 0, 10), square(10, 0, 10))).toBe(false);
  });

  it("is false for shapes sharing only a corner", () => {
    expect(polygonsOverlap(square(0, 0, 10), square(10, 10, 10))).toBe(false);
  });

  it("is true for a partial overlap", () => {
    expect(polygonsOverlap(square(0, 0, 10), square(5, 5, 10))).toBe(true);
  });

  it("is true for identical shapes", () => {
    expect(polygonsOverlap(square(0, 0, 10), square(0, 0, 10))).toBe(true);
  });

  it("is true when one sits inside the other (outer, inner)", () => {
    expect(polygonsOverlap(square(0, 0, 10), square(2, 2, 3))).toBe(true);
  });

  it("is true when one sits inside the other (inner, outer) — tests first disjunct", () => {
    expect(polygonsOverlap(square(2, 2, 3), square(0, 0, 10))).toBe(true);
  });

  it("is true for a half that shares three edges with the whole", () => {
    const half: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonsOverlap(half, square(0, 0, 10))).toBe(true);
  });

  it("is true for a half that shares three edges with the whole (swapped) — tests first disjunct", () => {
    const half: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonsOverlap(square(0, 0, 10), half)).toBe(true);
  });

  it("is true for overlapping with one much larger (large, small) — tests first disjunct", () => {
    expect(polygonsOverlap(square(5, 5, 10), square(0, 0, 10))).toBe(true);
  });

  it("is false for a shape that fills an L's notch exactly", () => {
    expect(polygonsOverlap(ell, square(10, 0, 10))).toBe(false);
  });

  it("detects overlap with clockwise winding (small inside large, cw inner)", () => {
    const cwSmall = [...square(2, 2, 3)].reverse();
    expect(polygonsOverlap(square(0, 0, 10), cwSmall)).toBe(true);
  });

  it("detects overlap with clockwise winding (cw outer, ccw inner)", () => {
    const cwOuter = [...square(0, 0, 10)].reverse();
    expect(polygonsOverlap(cwOuter, square(2, 2, 3))).toBe(true);
  });

  it("detects overlap with both clockwise", () => {
    const cwSmall = [...square(2, 2, 3)].reverse();
    const cwOuter = [...square(0, 0, 10)].reverse();
    expect(polygonsOverlap(cwOuter, cwSmall)).toBe(true);
  });

  it("is false for clockwise shapes sharing an edge — kills inward=1 mutation", () => {
    const cwSquare1 = [...square(0, 0, 10)].reverse();
    const cwSquare2 = [...square(10, 0, 10)].reverse();
    expect(polygonsOverlap(cwSquare1, cwSquare2)).toBe(false);
  });

  it("is true for identical clockwise shapes — kills inward=1 mutation", () => {
    const cwSquare = [...square(0, 0, 10)].reverse();
    expect(polygonsOverlap(cwSquare, cwSquare)).toBe(true);
  });

  it("is false for clockwise L's notch filled exactly — kills inward=1 mutation", () => {
    const cwEll = [...ell].reverse();
    const notch = square(10, 0, 10);
    expect(polygonsOverlap(cwEll, notch)).toBe(false);
  });

  it("is false for clockwise shapes sharing only a corner", () => {
    const cwSquare1 = [...square(0, 0, 10)].reverse();
    const cwSquare2 = [...square(10, 10, 10)].reverse();
    expect(polygonsOverlap(cwSquare1, cwSquare2)).toBe(false);
  });
});
