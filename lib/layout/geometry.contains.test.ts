import { describe, expect, it } from "vitest";

import { polygonContains } from "./crossings";
import { classify, interiorPoint } from "./geometry";
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

describe("polygonContains", () => {
  it("contains a shape inside, touching edges", () => {
    expect(polygonContains(square(0, 0, 10), square(0, 0, 5))).toBe(true);
  });

  it("contains a shape inside with swapped check", () => {
    expect(polygonContains(square(0, 0, 10), square(2, 2, 3))).toBe(true);
  });

  it("an inner does not contain outer", () => {
    expect(polygonContains(square(2, 2, 3), square(0, 0, 10))).toBe(false);
  });

  it("contains an identical shape", () => {
    expect(polygonContains(square(0, 0, 10), square(0, 0, 10))).toBe(true);
  });

  it("does not contain a shape poking out", () => {
    expect(polygonContains(square(0, 0, 10), square(8, 8, 5))).toBe(false);
  });

  it("does not contain a shape in an L's notch", () => {
    expect(polygonContains(ell, square(12, 2, 4))).toBe(false);
  });

  it("contains a shape in the L's lower arm", () => {
    expect(polygonContains(ell, square(12, 12, 4))).toBe(true);
  });

  it("contains with clockwise winding (cw outer, ccw inner)", () => {
    const cwOuter = [...square(0, 0, 10)].reverse();
    expect(polygonContains(cwOuter, square(2, 2, 3))).toBe(true);
  });

  it("contains with clockwise winding (ccw outer, cw inner)", () => {
    const cwInner = [...square(2, 2, 3)].reverse();
    expect(polygonContains(square(0, 0, 10), cwInner)).toBe(true);
  });

  it("contains with both clockwise", () => {
    const cwOuter = [...square(0, 0, 10)].reverse();
    const cwInner = [...square(2, 2, 3)].reverse();
    expect(polygonContains(cwOuter, cwInner)).toBe(true);
  });

  it("clockwise contains a shape inside, touching edges — kills inward=1 mutation", () => {
    const cwOuter = [...square(0, 0, 10)].reverse();
    expect(polygonContains(cwOuter, square(0, 0, 5))).toBe(true);
  });

  it("clockwise contains an identical shape — kills inward=1 mutation", () => {
    const cwSquare = [...square(0, 0, 10)].reverse();
    expect(polygonContains(cwSquare, cwSquare)).toBe(true);
  });

  it("clockwise does not contain a shape poking out", () => {
    const cwOuter = [...square(0, 0, 10)].reverse();
    expect(polygonContains(cwOuter, square(8, 8, 5))).toBe(false);
  });

  it("clockwise does not contain a shape in an L's notch", () => {
    const cwEll = [...ell].reverse();
    expect(polygonContains(cwEll, square(12, 2, 4))).toBe(false);
  });

  it("clockwise contains a shape in the L's lower arm", () => {
    const cwEll = [...ell].reverse();
    expect(polygonContains(cwEll, square(12, 12, 4))).toBe(true);
  });
});

describe("interiorPoint", () => {
  it("is inside a U, where the centroid is not", () => {
    const u: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
      { x: 20, y: 30 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
      { x: 0, y: 40 },
    ];
    expect(classify(interiorPoint(u), u)).toBe("inside");
  });
});
