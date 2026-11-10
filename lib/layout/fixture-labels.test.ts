import { describe, expect, it } from "vitest";

import { labelAngle, shownLabels } from "./fixture-labels";
import { fixture, store, zone } from "./test-layouts";

// At scale 2 a 12 px name is 6 in tall and about 3.4 in a character.
const SCALE = 2;

describe("shownLabels", () => {
  it("names every fixture whose name has room and touches no other", () => {
    const layout = { ...store(), fixtures: [fixture(), fixture({ id: "fixture-b", name: "Table 2", y: 200 })] };
    expect(shownLabels(layout, SCALE)).toEqual(new Set(["fixture-a", "fixture-b"]));
  });

  it("of two names that would overlap, keeps the bigger fixture's", () => {
    // One over the other, names 4 in apart: each fits its own fixture, but they touch.
    const big = fixture({ id: "big", name: "Denim feature table", x: 300, y: 100, width: 120, depth: 40 });
    const small = fixture({ id: "small", name: "Accessories round", x: 300, y: 104, width: 80, depth: 30 });
    expect(shownLabels({ ...store(), fixtures: [small, big] }, SCALE)).toEqual(new Set(["big"]));
  });

  it("gives a set's lower tables no name; the upper keeps its own", () => {
    const upper = fixture({ id: "upper", name: "Front Table set", tableSetId: "set" });
    const front = fixture({ id: "front", name: "Front", y: 160, tableSetId: "set", setSide: "front" });
    const back = fixture({ id: "back", name: "Back", y: 40, tableSetId: "set", setSide: "back" });
    expect(shownLabels({ ...store(), fixtures: [upper, front, back] }, SCALE)).toEqual(new Set(["upper"]));
  });

  it("a zone's name wins over a fixture name drawn across it", () => {
    const named = zone({ name: "Front tables" });
    // The zone's name sits in its top-left corner, at y ≈ 6; this table's name is drawn there too.
    const under = fixture({ name: "Table 1", x: 40, y: 6, width: 72, depth: 30 });
    expect(shownLabels({ ...store(), zones: [named], fixtures: [under] }, SCALE)).toEqual(new Set());
  });

  it("names nothing whose whole name doesn't fit along the fixture's longest edge", () => {
    // About 64 in of name at this scale on a 72 in table: fits. On 60 in: hidden.
    const long = { name: "Denim feature table", depth: 36 };
    expect(shownLabels({ ...store(), fixtures: [fixture({ ...long, width: 72 })] }, SCALE)).toEqual(new Set(["fixture-a"]));
    expect(shownLabels({ ...store(), fixtures: [fixture({ ...long, width: 60 })] }, SCALE)).toEqual(new Set());
  });

  it("names a fixture standing on end along its depth", () => {
    const deep = fixture({ name: "Denim feature table", width: 36, depth: 72 });
    expect(shownLabels({ ...store(), fixtures: [deep] }, SCALE)).toEqual(new Set(["fixture-a"]));
  });

  it("names nothing on a fixture too small on screen for it", () => {
    expect(shownLabels({ ...store(), fixtures: [fixture({ width: 24, depth: 24 })] }, SCALE)).toEqual(new Set());
  });
});

describe("labelAngle", () => {
  it("runs along the longer side, the width on a tie", () => {
    expect(labelAngle({ rotation: 0, width: 72, depth: 36 })).toBe(0);
    expect(labelAngle({ rotation: 0, width: 36, depth: 72 })).toBe(-90);
    expect(labelAngle({ rotation: 0, width: 48, depth: 48 })).toBe(0);
  });

  it("never reads upside down: left to right, or bottom to top on end", () => {
    expect(labelAngle({ rotation: 180, width: 72, depth: 36 })).toBe(0);
    expect(labelAngle({ rotation: 90, width: 72, depth: 36 })).toBe(-90);
    expect(labelAngle({ rotation: 270, width: 72, depth: 36 })).toBe(-90);
    expect(labelAngle({ rotation: 135, width: 72, depth: 36 })).toBe(-45);
    expect(labelAngle({ rotation: -30, width: 72, depth: 36 })).toBe(-30);
  });
});
