import { describe, expect, it } from "vitest";

import { OVERVIEW, handlesFor, hitTest } from "./hit-test";
import { entrance, fixture, store, zone } from "./test-layouts";
import { OUTLINE_ID } from "./types";

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

  it("gives a wall bay only width handles and a rotate handle", () => {
    const bay = { ...layout, fixtures: [fixture({ id: "b", type: "wall_bay", width: 48, depth: 24 })] };
    const kinds = handlesFor(bay, ["b"], camera).map((h) => (h.ref.kind === "resize" ? h.ref.side : h.ref.kind));
    expect(kinds.sort()).toEqual(["left", "right", "rotate"]);
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
