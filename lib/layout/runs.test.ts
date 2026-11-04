import { describe, expect, it } from "vitest";

import { poseAtEnd, rackEnds, readingOrder, runShape, snapRun, turnBetween, type RunRack } from "./runs";

const rack = (id: string, runIndex: number, x: number, y: number, rotation = 0, width = 48): RunRack => ({ id, runIndex, x, y, width, rotation });

// At rotation 0 the rail runs along x: left end at x − 24, right end at x + 24.
const straight = [rack("a", 0, 0, 0), rack("b", 1, 48, 0), rack("c", 2, 96, 0)];
// An L: b turns 90° at a's right end, so its rail runs down from (24, 0).
const ell = [rack("a", 0, 0, 0), rack("b", 1, 24, 24, 90)];
// A closed square of four 48 in racks, turning 90° at each corner.
const square = [rack("a", 0, 0, 0), rack("b", 1, 24, 24, 90), rack("c", 2, 0, 48, 180), rack("d", 3, -24, 24, 270)];

describe("runShape", () => {
  it("reads a straight run", () => {
    expect(runShape(straight)).toEqual({ order: ["a", "b", "c"], joins: ["straight", "straight"], closed: false, joined: true });
  });

  it("reads an L and a U", () => {
    expect(runShape(ell).joins).toEqual(["corner"]);
    const u = [...ell, rack("c", 2, 0, 48, 180)];
    expect(runShape(u)).toMatchObject({ joins: ["corner", "corner"], closed: false, joined: true });
  });

  it("reads a closed square", () => {
    expect(runShape(square)).toMatchObject({ joins: ["corner", "corner", "corner"], closed: true, joined: true });
  });

  it("orders by run index, not array order", () => {
    expect(runShape([straight[2], straight[0], straight[1]]).order).toEqual(["a", "b", "c"]);
  });

  it("refuses a gap, within a 1 in tolerance", () => {
    expect(runShape([rack("a", 0, 0, 0), rack("b", 1, 49, 0)]).joined).toBe(true);
    expect(runShape([rack("a", 0, 0, 0), rack("b", 1, 50, 0)])).toMatchObject({ joins: [null], joined: false });
  });

  it("refuses a 45° turn and a U-turn", () => {
    expect(turnBetween({ rotation: 0 }, { rotation: 45 })).toBeNull();
    expect(turnBetween({ rotation: 0 }, { rotation: 180 })).toBeNull();
    expect(turnBetween({ rotation: 350 }, { rotation: 80 })).toBe("corner");
  });
});

describe("snapRun", () => {
  it("slides racks onto the end before them, from the anchor out", () => {
    const loose = [rack("a", 0, 0, 0), rack("b", 1, 51, 3, 2), rack("c", 2, 110, -4, 359)];
    const moved = snapRun(loose);
    expect(moved.map((r) => [r.id, r.x, r.y, r.rotation])).toEqual([
      ["b", 48, 0, 0],
      ["c", 96, 0, 0],
    ]);
  });

  it("rounds a rough turn to a corner", () => {
    const moved = snapRun([rack("a", 0, 0, 0), rack("b", 1, 30, 30, 85)]);
    expect(moved[0]).toMatchObject({ x: 24, y: 24, rotation: 90 });
    expect(runShape([rack("a", 0, 0, 0), moved[0]]).joins).toEqual(["corner"]);
  });

  it("moves nothing that already fits", () => {
    expect(snapRun(square)).toEqual([]);
  });
});

describe("poseAtEnd and readingOrder", () => {
  it("puts a new straight rack at either end", () => {
    expect(poseAtEnd(straight[2], "right", 48)).toEqual({ x: 144, y: 0, rotation: 0 });
    expect(poseAtEnd(straight[0], "left", 36)).toEqual({ x: -42, y: 0, rotation: 0 });
    const turned = rack("t", 0, 0, 0, 90);
    expect(rackEnds(turned).right).toEqual({ x: 0, y: 24 });
    expect(poseAtEnd(turned, "right", 48)).toEqual({ x: 0, y: 48, rotation: 90 });
  });

  it("reads from the anchor, or from the start index on a closed run", () => {
    expect(readingOrder(square, 2)).toEqual(["c", "d", "a", "b"]);
    expect(readingOrder(straight, 2)).toEqual(["a", "b", "c"]);
  });
});
