import { describe, expect, it } from "vitest";

import {
  bandPath,
  bendFromHandle,
  distanceToFixture,
  fixturesOverlap,
  footprint,
  halfChord,
  maxCurve,
  middleOf,
  resizeCurved,
  snapPoints,
} from "./curves";
import { corners } from "./fixtures";
import { bounds, distance, polygonContains, selfIntersects } from "./geometry";
import { MAX_CURVE } from "./limits";
import { fixture } from "./test-layouts";

const bay = (over = {}) => fixture({ type: "wall_bay", x: 500, y: 500, width: 120, depth: 24, rotation: 0, ...over });

describe("maxCurve", () => {
  it("stops at a half circle on a long, shallow bay", () => {
    expect(maxCurve(120, 12)).toBe(Math.floor(120 / Math.PI));
  });

  it("stops sooner when depth would fold the inner edge over", () => {
    expect(maxCurve(48, 24)).toBeLessThan(Math.floor(48 / Math.PI));
    expect(maxCurve(48, 24)).toBeGreaterThan(0);
  });

  it("never passes the database's limit", () => {
    expect(maxCurve(600, 12)).toBe(MAX_CURVE);
  });
});

describe("the arc", () => {
  it("is straight at 0: the footprint is exactly the corners", () => {
    const f = bay({ rotation: 30 });
    expect(footprint(f)).toEqual(corners(f));
    expect(halfChord(f)).toBe(60);
    expect(middleOf(f)).toEqual({ x: 500, y: 500 });
  });

  it("puts the middle `curve` inches toward the front, ends on the line", () => {
    const f = bay({ curve: 20 });
    expect(middleOf(f).x).toBeCloseTo(500);
    expect(middleOf(f).y).toBeCloseTo(520);
    const back = bay({ curve: -20 });
    expect(middleOf(back).y).toBeCloseTo(480);
  });

  it("keeps its length: the ends draw in as it bends", () => {
    const f = bay({ curve: 30 });
    expect(halfChord(f)).toBeLessThan(60);
    expect(halfChord(f)).toBeGreaterThan(30);
  });

  it("turns with the fixture", () => {
    const f = bay({ curve: 20, rotation: 90 });
    expect(middleOf(f).x).toBeCloseTo(480);
    expect(middleOf(f).y).toBeCloseTo(500);
  });

  it("makes a simple band as deep as the fixture", () => {
    const shape = footprint(bay({ curve: 38 }));
    expect(selfIntersects(shape)).toBe(false);
    expect(shape.length).toBeGreaterThan(8);
    // Back edge of the middle and front edge of the middle are one depth apart.
    const half = shape.length / 2;
    const backMiddle = shape[Math.floor((half - 1) / 2)];
    const frontMiddle = shape[half + Math.floor((half - 1) / 2)];
    expect(distance(backMiddle, frontMiddle)).toBeCloseTo(24, 0);
  });

  it("draws the same band it collides with", () => {
    const path = bandPath(bay({ curve: 20 }));
    expect(path.match(/A /g)).toHaveLength(2);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("sweeps the other way when it bends back", () => {
    const sweep = (curve: number) => bandPath(bay({ curve })).match(/A \S+ \S+ 0 0 (\d)/)?.[1];
    expect(sweep(20)).toBe("0");
    expect(sweep(-20)).toBe("1");
  });
});

describe("fixturesOverlap", () => {
  it("lets something sit in the pocket of a curve, where the rectangle would have clashed", () => {
    const curved = bay({ id: "a", curve: -38 });
    // In front of the ends' line, inside the bend, clear of the band.
    const table = fixture({ id: "b", x: 500, y: 500, width: 30, depth: 30 });
    expect(fixturesOverlap(curved, table)).toBe(false);
  });

  it("catches a fixture on the band", () => {
    const curved = bay({ id: "a", curve: 38 });
    const table = fixture({ id: "b", x: 500, y: 538, width: 30, depth: 30 });
    expect(fixturesOverlap(curved, table)).toBe(true);
  });

  it("is the rectangle test when both are straight", () => {
    expect(fixturesOverlap(bay({ id: "a" }), bay({ id: "b", x: 620 }))).toBe(false);
    expect(fixturesOverlap(bay({ id: "a" }), bay({ id: "b", x: 619 }))).toBe(true);
  });
});

describe("distanceToFixture", () => {
  it("is 0 on the band and more in the pocket", () => {
    const f = bay({ curve: 30 });
    expect(distanceToFixture(f, { x: 500, y: 530 })).toBe(0);
    expect(distanceToFixture(f, { x: 500, y: 500 })).toBeGreaterThan(10);
  });
});

describe("snapPoints", () => {
  it("are a curved bay's bounding box, so its back can meet a wall", () => {
    const f = bay({ curve: 30 });
    const box = bounds(footprint(f));
    expect(snapPoints(f)).toHaveLength(4);
    expect(bounds(snapPoints(f))).toEqual(box);
  });
});

describe("bendFromHandle", () => {
  const origin = { x: 500, y: 512 };

  it("adds how far the handle travelled toward the front", () => {
    expect(bendFromHandle(bay(), origin, { x: 500, y: 532 }, true)).toBe(20);
    expect(bendFromHandle(bay({ curve: 20 }), origin, { x: 500, y: 502 }, true)).toBe(10);
  });

  it("bends back when pushed behind the line", () => {
    expect(bendFromHandle(bay(), origin, { x: 500, y: 492 }, true)).toBe(-20);
  });

  it("stops at the limit", () => {
    expect(bendFromHandle(bay(), origin, { x: 500, y: 2000 }, true)).toBe(maxCurve(120, 24));
    expect(bendFromHandle(bay(), origin, { x: 500, y: -2000 }, true)).toBe(-maxCurve(120, 24));
  });

  it("snaps nearly straight to straight, only while snapping", () => {
    expect(bendFromHandle(bay(), origin, { x: 500, y: 514 }, true)).toBe(0);
    expect(bendFromHandle(bay(), origin, { x: 500, y: 514 }, false)).toBe(2);
    expect(Object.is(bendFromHandle(bay(), origin, { x: 500, y: 511.8 }, false), -0)).toBe(false);
  });

  it("reads the drag in the fixture's own frame", () => {
    expect(bendFromHandle(bay({ rotation: 90 }), { x: 488, y: 500 }, { x: 468, y: 500 }, true)).toBe(20);
  });
});

describe("resizeCurved", () => {
  it("reads the new length from the arc through the pointer", () => {
    const f = bay({ curve: 30 });
    const end = halfChord(f);
    expect(resizeCurved(f, { x: 500 + end, y: 500 })).toBeCloseTo(120, -0.5);
    expect(resizeCurved(f, { x: 500 + end + 20, y: 500 })).toBeGreaterThan(130);
    expect(resizeCurved(f, { x: 500 - end - 20, y: 500 })).toBeGreaterThan(130);
  });

  it("stops at a half circle rather than folding past it", () => {
    const f = bay({ curve: 30 });
    expect(resizeCurved(f, { x: 500, y: 500 })).toBe(Math.round(Math.PI * 30));
  });
});

describe("containment", () => {
  const store = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
    { x: 0, y: 400 },
  ];

  it("goes by the band, not the rectangle: a middle bent through the wall is outside", () => {
    const f = bay({ x: 200, y: 30, depth: 12, curve: -38 });
    expect(polygonContains(store, corners(f))).toBe(true);
    expect(polygonContains(store, footprint(f))).toBe(false);
  });

  it("fits once there is floor behind the bend", () => {
    expect(polygonContains(store, footprint(bay({ x: 200, y: 60, depth: 12, curve: -38 })))).toBe(true);
  });
});
