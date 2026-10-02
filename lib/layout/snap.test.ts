import { describe, expect, it } from "vitest";

import { corners } from "./fixtures";
import { snapAngle, snapDelta, snapPoint, targetsFor } from "./snap";
import { EMPTY_LAYOUT, OUTLINE_ID, type Layout } from "./types";

const targets = { xs: [100], ys: [200] };

describe("snapDelta", () => {
  it("pulls a moving edge onto a nearby line", () => {
    // At 1 px/in the threshold is 12 in. Moving x 0 → 95 lands 5 in from 100.
    const result = snapDelta([{ x: 0, y: 0 }], { x: 95, y: 0 }, targets, 1);
    expect(result.delta.x).toBe(100);
    expect(result.guides).toEqual([{ axis: "x", value: 100 }]);
  });

  it("leaves a move alone beyond the threshold, apart from the grid", () => {
    const result = snapDelta([{ x: 0, y: 0 }], { x: 80, y: 0 }, targets, 1);
    // No line within 12 in; the nearest 6 in grid line is 78 or 84, 80 → 78.
    expect(result.delta.x).toBe(78);
    expect(result.guides).toEqual([]);
  });

  it("reaches further when zoomed out, so it feels the same on screen", () => {
    // At 0.25 px/in the threshold is 48 in.
    expect(snapDelta([{ x: 0, y: 0 }], { x: 60, y: 0 }, targets, 0.25).delta.x).toBe(100);
  });

  it("takes the closest line among several moving points", () => {
    // Two edges 50 in apart; the right edge is 3 in from 100.
    const result = snapDelta([{ x: 0, y: 0 }, { x: 50, y: 0 }], { x: 47, y: 0 }, targets, 1);
    expect(result.delta.x).toBe(50);
  });

  it("only rounds when snapping is off", () => {
    expect(snapDelta([{ x: 0, y: 0 }], { x: 95.4, y: 3.6 }, targets, 1, false)).toEqual({
      delta: { x: 95, y: 4 },
      guides: [],
    });
  });
});

describe("snapPoint", () => {
  it("lands on whole inches", () => {
    const { point } = snapPoint({ x: 99.3, y: 150.2 }, targets, 1);
    expect(point).toEqual({ x: 100, y: 150 });
  });
});

describe("snapAngle", () => {
  it("snaps to 15° steps, or rounds when off", () => {
    expect(snapAngle(22)).toBe(15);
    expect(snapAngle(23)).toBe(30);
    expect(snapAngle(-7)).toBe(0);
    expect(snapAngle(22.4, false)).toBe(22);
  });
});

describe("targetsFor", () => {
  const layout: Layout = {
    ...EMPTY_LAYOUT,
    outline: { points: [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 360 }], version: 1 },
    zones: [
      {
        id: "z",
        name: "Zone 1",
        type: "display",
        color: "zone-1",
        points: [{ x: 12, y: 12 }, { x: 60, y: 12 }, { x: 60, y: 60 }],
        version: 1,
      },
    ],
  };

  it("offers the outline's and zones' corners", () => {
    const t = targetsFor(layout, new Set());
    expect(t.xs).toEqual(expect.arrayContaining([0, 480, 12, 60]));
  });

  it("leaves out the items being moved", () => {
    expect(targetsFor(layout, new Set(["z"])).xs).not.toContain(12);
  });

  it("omits the outline's corners when OUTLINE_ID is excluded", () => {
    const t = targetsFor(layout, new Set([OUTLINE_ID]));
    expect(t.xs).not.toContain(0);
    expect(t.xs).not.toContain(480);
    expect(t.ys).not.toContain(0);
    expect(t.ys).not.toContain(360);
  });

  it("includes square-on fixtures but excludes slanted ones", () => {
    const layoutWithFixtures: Layout = {
      ...EMPTY_LAYOUT,
      outline: { points: [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 360 }], version: 1 },
      fixtures: [
        {
          id: "f1",
          zoneId: null,
          type: "table",
          name: "Table 1",
          x: 100,
          y: 100,
          width: 48,
          depth: 48,
          rotation: 0, // square-on
          tableSetId: null,
          setSide: null,
          version: 0,
        },
        {
          id: "f2",
          zoneId: null,
          type: "table",
          name: "Table 2",
          x: 200,
          y: 200,
          width: 48,
          depth: 48,
          rotation: 45, // slanted
          tableSetId: null,
          setSide: null,
          version: 0,
        },
      ],
    };
    const t = targetsFor(layoutWithFixtures, new Set());
    // Square-on fixture at (100, 100) with width/depth 48 has corners at (76, 76), (76, 124), (124, 124), (124, 76)
    expect(t.xs).toEqual(expect.arrayContaining([76, 124]));
    expect(t.ys).toEqual(expect.arrayContaining([76, 124]));
    // Slanted fixture is excluded from targets
    for (const corner of corners(layoutWithFixtures.fixtures[1])) {
      expect(t.xs).not.toContain(corner.x);
      expect(t.ys).not.toContain(corner.y);
    }
    // If we exclude f2, square-on fixture remains
    expect(targetsFor(layoutWithFixtures, new Set(["f2"])).xs).toEqual(expect.arrayContaining([76, 124]));
    // Excluding the square-on fixture (it is being moved) removes its corners
    const withoutF1 = targetsFor(layoutWithFixtures, new Set(["f1"]));
    expect(withoutF1.xs).not.toContain(76);
    expect(withoutF1.xs).not.toContain(124);
    expect(withoutF1.ys).not.toContain(76);
    expect(withoutF1.ys).not.toContain(124);
  });
});

describe("snapDelta with outline excluded", () => {
  const layout: Layout = {
    ...EMPTY_LAYOUT,
    outline: { points: [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 360 }], version: 1 },
  };

  it("does not snap an outline corner back to itself when excluded", () => {
    const targets = targetsFor(layout, new Set([OUTLINE_ID]));
    // Moving outline corner at (0, 0) by 5 inches right.
    // Outline corners (0, 480, 360) are excluded, so no line at x=0.
    // Grid snap would move to nearest 6in line: 6 (1 inch away).
    const result = snapDelta([{ x: 0, y: 0 }], { x: 5, y: 0 }, targets, 1);
    expect(result.delta.x).not.toBe(0);
  });
});
