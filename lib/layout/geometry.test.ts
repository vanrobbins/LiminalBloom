import { describe, expect, it } from "vitest";

import {
  area,
  centroid,
  classify,
  interiorPoint,
  intersect,
  polygonContains,
  polygonsOverlap,
  selfIntersects,
} from "./geometry";
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
