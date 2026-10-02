import { describe, expect, it } from "vitest";

import type { Session } from "./session-core";
import { NO_ROOM } from "./session-edits";
import { face, fixture, rectangle, store, zone } from "./test-layouts";
import { editing, reducer } from "./test-sessions";

describe("add", () => {
  it("puts a new rack in the middle of the view, selected", () => {
    const reduce = reducer();
    // 800 × 600 view at 1 px/in, from 0,0: the middle is 400, 300.
    const s = reduce(editing(store()), { type: "add", kind: "rack" });
    const rack = s.layout.fixtures.find((f) => f.type === "rack");
    expect(rack).toMatchObject({ x: 400, y: 300, name: "Rack 1" });
    expect(s.selection).toEqual([rack?.id]);
    expect(s.layout.faces.filter((f) => f.fixtureId === rack?.id)).toHaveLength(1);
  });

  it("nudges it to the nearest free spot when the middle is taken", () => {
    const reduce = reducer();
    const s = reduce(editing({ ...store(), fixtures: [fixture({ x: 400, y: 300 })] }), { type: "add", kind: "rack" });
    const rack = s.layout.fixtures.find((f) => f.type === "rack")!;
    expect(rack.x !== 400 || rack.y !== 300).toBe(true);
    expect(s.notice).toBeNull();
  });

  it("says when there is no room", () => {
    const reduce = reducer();
    const tiny = { ...store(60, 60), fixtures: [fixture({ type: "platform", name: "Platform 1", x: 30, y: 30, width: 48, depth: 48 })] };
    const s = reduce({ ...editing(tiny), camera: { x: -370, y: -270, scale: 1 } }, { type: "add", kind: "rack" });
    expect(s.notice).toBe(NO_ROOM);
  });

  it("at the overview, keeps a new fixture on the store floor so it can be dragged (spec §7)", () => {
    const reduce = reducer();
    const middle = { ...store(), zones: [zone({ points: rectangle(320, 240, 160, 120) })] };
    const s = reduce(editing(middle), { type: "add", kind: "rack" });
    const rack = s.layout.fixtures.find((f) => f.type === "rack")!;
    expect(rack.zoneId).toBeNull();
    expect(rack.x < 320 || rack.y < 240).toBe(true);
  });

  it("at the overview, says there is no room when zones cover the floor", () => {
    const reduce = reducer();
    const covered = { ...store(), zones: [zone({ points: rectangle(0, 0, 480, 360) })] };
    const s = reduce(editing(covered), { type: "add", kind: "rack" });
    expect(s.notice).toBe(NO_ROOM);
    expect(s.layout).toBe(covered);
  });

  it("inside a focused zone, still puts the new fixture in that zone", () => {
    const reduce = reducer();
    const covered = { ...store(), zones: [zone({ points: rectangle(0, 0, 480, 360) })] };
    const focused = reduce(editing(covered), { type: "focus", focus: { kind: "zone", id: "zone-a" } });
    const s = reduce(focused, { type: "add", kind: "rack" });
    expect(s.layout.fixtures.find((f) => f.type === "rack")?.zoneId).toBe("zone-a");
  });

  it("asks for the outline first", () => {
    const reduce = reducer();
    expect(reduce(editing({ ...store(), outline: null }), { type: "add", kind: "rack" }).notice).toBe("Set up the store outline first.");
  });
});

describe("delete", () => {
  it("will not take a shape below three corners", () => {
    const reduce = reducer();
    const triangle = { ...store(), zones: [zone({ points: rectangle(0, 0, 100, 100).slice(0, 3) })] };
    const s = reduce({ ...editing(triangle), vertex: { owner: { kind: "zone", id: "zone-a" }, index: 0 } }, { type: "delete" });
    expect(s.notice).toBe("A shape needs at least 3 corners.");
    expect(s.layout).toBe(triangle);
  });

  it("deletes the selection", () => {
    const reduce = reducer();
    const s = reduce({ ...editing({ ...store(), fixtures: [fixture()] }), selection: ["fixture-a"] }, { type: "delete" });
    expect(s.layout.fixtures).toEqual([]);
    expect(s.selection).toEqual([]);
  });
});

describe("duplicate, nudge, rotate", () => {
  it("selects the copy", () => {
    const reduce = reducer();
    const s = reduce({ ...editing({ ...store(), fixtures: [fixture()], faces: [face()] }), selection: ["fixture-a"] }, { type: "duplicate" });
    expect(s.selection).toHaveLength(1);
    expect(s.layout.fixtures.find((f) => f.id === s.selection[0])?.name).toBe("Table 2");
  });

  it("puts the copy below when the right side is taken", () => {
    const reduce = reducer();
    // The table is 72 × 36 at 300,100: right is x 384–456 (the wall bay), below is y 148–184.
    const layout = { ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Wall 1", x: 420, y: 100, width: 72, depth: 36 })], faces: [face(), face({ id: "face-b", fixtureId: "b" })] };
    const s = reduce({ ...editing(layout), selection: ["fixture-a"] }, { type: "duplicate" });
    const copy = s.layout.fixtures.find((f) => f.id === s.selection[0])!;
    expect(copy).toMatchObject({ x: 300, y: 148 });
    expect(s.notice).toBeNull();
  });

  it("selects only the copied zone, not the fixtures it carries", () => {
    const reduce = reducer();
    const layout = { ...store(800, 600), zones: [zone()], fixtures: [fixture({ zoneId: "zone-a", x: 100, y: 100 })], faces: [face()] };
    const s = reduce({ ...editing(layout), selection: ["zone-a"] }, { type: "duplicate" });
    expect(s.layout.zones).toHaveLength(2);
    expect(s.selection).toHaveLength(1);
    expect(s.layout.zones.some((z) => z.id === s.selection[0])).toBe(true);
  });

  it("nudges by whole inches without snapping", () => {
    const reduce = reducer();
    const s = reduce({ ...editing({ ...store(), fixtures: [fixture()] }), selection: ["fixture-a"] }, { type: "nudge", dx: 1, dy: 0 });
    expect(s.layout.fixtures[0].x).toBe(301);
  });

  it("rotates by 15°", () => {
    const reduce = reducer();
    const s = reduce({ ...editing({ ...store(), fixtures: [fixture()] }), selection: ["fixture-a"] }, { type: "rotate", by: 15 });
    expect(s.layout.fixtures[0].rotation).toBe(15);
  });
});

describe("escape", () => {
  it("backs out one step at a time", () => {
    const reduce = reducer();
    let s: Session = { ...editing({ ...store(), zones: [zone()] }), focus: { kind: "zone", id: "zone-a" } as const, selection: ["zone-a"] };
    s = reduce(s, { type: "escape" });
    expect(s.selection).toEqual([]);
    expect(s.focus.kind).toBe("zone");
    s = reduce(s, { type: "escape" });
    expect(s.focus.kind).toBe("overview");
  });
});

describe("setRectangle", () => {
  it("sets the outline and fits the view to it", () => {
    const reduce = reducer();
    const s = reduce(editing({ ...store(), outline: null }), { type: "setRectangle", width: 480, depth: 360 });
    expect(s.layout.outline?.points).toEqual(rectangle(0, 0, 480, 360));
    expect(s.camera.scale).toBeCloseTo((600 - 48) / 360, 9);
  });

  it("leaves the view alone when the outline is refused", () => {
    const reduce = reducer();
    const before = editing({ ...store(), outline: null });
    const s = reduce(before, { type: "setRectangle", width: 5, depth: 5 });
    expect(s.layout).toBe(before.layout);
    expect(s.camera).toBe(before.camera);
  });
});
