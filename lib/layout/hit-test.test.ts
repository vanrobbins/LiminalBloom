import { describe, expect, it } from "vitest";

import { OVERVIEW, handlesFor, hitTest } from "./hit-test";
import { entrance, fixture, store, zone } from "./test-layouts";
import { OUTLINE_ID, type Fixture } from "./types";

const camera = { x: 0, y: 0, scale: 1 };
const layout = {
  ...store(),
  zones: [zone()],
  fixtures: [fixture({ id: "in-zone", name: "Table 1", x: 100, y: 100, zoneId: "zone-a" }), fixture({ id: "loose", name: "Table 2", x: 380, y: 100 })],
  entrances: [entrance()],
};

describe("hitTest", () => {
  it("at the overview, hits zones and store-level fixtures, not fixtures in zones", () => {
    expect(hitTest(layout, OVERVIEW, camera, { x: 100, y: 100 }, [], true)).toEqual({ kind: "zone", id: "zone-a" });
    expect(hitTest(layout, OVERVIEW, camera, { x: 380, y: 100 }, [], true)).toEqual({ kind: "fixture", id: "loose" });
  });

  it("inside a focused zone, hits its fixtures and nothing outside it", () => {
    const focus = { kind: "zone", id: "zone-a" } as const;
    expect(hitTest(layout, focus, camera, { x: 100, y: 100 }, [], true)).toEqual({ kind: "fixture", id: "in-zone" });
    expect(hitTest(layout, focus, camera, { x: 380, y: 100 }, [], true)).toEqual({ kind: "empty" });
  });

  it("hits an entrance on its wall", () => {
    expect(hitTest(layout, OVERVIEW, camera, { x: 240, y: 356 }, [], true)).toEqual({ kind: "entrance", id: "entrance-a" });
  });

  it("puts handles first", () => {
    const handles = handlesFor(layout, ["loose"], camera);
    const right = handles.find((h) => h.ref.kind === "resize" && h.ref.side === "right")!;
    expect(hitTest(layout, OVERVIEW, camera, right.at, handles, true)).toEqual({ kind: "handle", ref: right.ref });
  });

  it("uses the fixture's own frame when it is rotated", () => {
    const turned = { ...layout, fixtures: [fixture({ id: "loose", x: 380, y: 100, rotation: 90 })] };
    // Inside the unrotated 72 × 36 box, but outside the turned 36 × 72 one.
    expect(hitTest(turned, OVERVIEW, camera, { x: 410, y: 100 }, [], true)).toEqual({ kind: "empty" });
    expect(hitTest(turned, OVERVIEW, camera, { x: 380, y: 130 }, [], true)).toEqual({ kind: "fixture", id: "loose" });
  });

  it("on the read-only map, ignores entrances and handles", () => {
    const handles = handlesFor(layout, ["loose"], camera);
    expect(hitTest(layout, OVERVIEW, camera, { x: 240, y: 356 }, handles, false)).toEqual({ kind: "empty" });
  });

  it("selects the outline from a wall with no zone against it", () => {
    expect(hitTest(layout, OVERVIEW, camera, { x: 478, y: 300 }, [], true)).toEqual({ kind: "outline" });
  });
});

describe("handlesFor", () => {
  it("gives a zone a corner handle per corner and a + per edge", () => {
    const handles = handlesFor(layout, ["zone-a"], camera);
    expect(handles.filter((h) => h.ref.kind === "vertex")).toHaveLength(4);
    expect(handles.filter((h) => h.ref.kind === "midpoint")).toHaveLength(4);
  });

  it("gives a wall bay width handles, a rotate handle and a curve handle", () => {
    const bay = { ...layout, fixtures: [fixture({ id: "b", type: "wall_bay", width: 48, depth: 24 })] };
    const kinds = handlesFor(bay, ["b"], camera).map((h) => (h.ref.kind === "resize" ? h.ref.side : h.ref.kind));
    expect(kinds.sort()).toEqual(["curve", "left", "right", "rotate"]);
  });

  it("moves handles outside a fixture that is small on screen", () => {
    const small = { x: 0, y: 0, scale: 0.5 };
    const right = handlesFor(layout, ["loose"], small).find((h) => h.ref.kind === "resize" && h.ref.side === "right")!;
    // 36 in deep × 0.5 px/in = 18 px, under 44 px: the handle sits 22 px (44 in) beyond the edge.
    expect(right.at.x).toBe(380 + 36 + 44);
  });

  it("shows nothing for several items, or for the outline when it is not selected", () => {
    expect(handlesFor(layout, ["zone-a", "loose"], camera)).toEqual([]);
    expect(handlesFor(layout, [], camera)).toEqual([]);
    expect(handlesFor(layout, [OUTLINE_ID], camera)).toHaveLength(8);
  });
});

describe("curved wall bays", () => {
  // Zoomed in enough that the handles sit on the shape.
  const zoomed = { x: 0, y: 0, scale: 2 };
  const bay = (over: Partial<Fixture> = {}) =>
    fixture({ id: "bay", type: "wall_bay", x: 240, y: 180, width: 120, depth: 24, ...over });
  const spots = (f: Fixture) => handlesFor({ ...store(), fixtures: [f] }, ["bay"], zoomed);
  const at = (f: Fixture, kind: string, side?: string) =>
    spots(f).find((h) => h.ref.kind === kind && (side === undefined || (h.ref.kind === "resize" && h.ref.side === side)))?.at;

  it("gives every wall bay a curve handle on the front edge, and nothing else one", () => {
    expect(at(bay(), "curve")).toEqual({ x: 240, y: 192 });
    const table = fixture({ id: "bay", x: 240, y: 180 });
    expect(at(table, "curve")).toBeUndefined();
  });

  it("keeps the handle on the middle of the curve", () => {
    expect(at(bay({ curve: 30 }), "curve")?.y).toBeCloseTo(222);
    expect(at(bay({ curve: -30 }), "curve")?.y).toBeCloseTo(162);
  });

  it("puts the end handles on the ends of the arc", () => {
    const right = at(bay({ curve: 30 }), "resize", "right");
    expect(right?.x).toBeLessThan(300);
    expect(right?.y).toBeCloseTo(180);
  });

  it("keeps the rotate handle clear when the bay bends back", () => {
    const straight = at(bay(), "rotate");
    const bent = at(bay({ curve: -30 }), "rotate");
    expect(bent?.y).toBeCloseTo((straight?.y ?? 0) - 30);
  });

  it("hits the band, not the pocket", () => {
    const layout = { ...store(), fixtures: [bay({ curve: 30 })] };
    expect(hitTest(layout, OVERVIEW, camera, { x: 240, y: 210 }, [], true)).toEqual({ kind: "fixture", id: "bay" });
    expect(hitTest(layout, OVERVIEW, camera, { x: 240, y: 182 }, [], true)).toEqual({ kind: "empty" });
  });
});
