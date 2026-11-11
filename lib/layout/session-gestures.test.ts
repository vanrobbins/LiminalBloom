import { describe, expect, it } from "vitest";

import type { GestureEffect } from "./gesture";
import type { HitTarget } from "./hit-test";
import { endsOf } from "./runs";
import type { Session } from "./session-core";
import { face, fixture, store, zone } from "./test-layouts";
import { editing, reducer } from "./test-sessions";
import { EMPTY_LAYOUT } from "./types";

type Reduce = ReturnType<typeof reducer>;

function gesture(reduce: Reduce, session: Session, ...effects: GestureEffect<HitTarget>[]): Session {
  return effects.reduce((s, effect) => reduce(s, { type: "gesture", effect }), session);
}

const at = (x: number, y: number) => ({ x, y });
const tap = (target: HitTarget, x = 0, y = 0): GestureEffect<HitTarget> => ({ type: "tap", target, point: at(x, y), shift: false });
const drag = (target: HitTarget, from: [number, number], to: [number, number]): GestureEffect<HitTarget>[] => [
  { type: "dragStart", target, origin: at(...from) },
  { type: "drag", target, origin: at(...from), point: at(...to) },
  { type: "dragEnd", target, origin: at(...from), point: at(...to) },
];

describe("taps", () => {
  it("selects a fixture", () => {
    const reduce = reducer();
    const s = gesture(reduce, editing({ ...store(), fixtures: [fixture()] }), tap({ kind: "fixture", id: "fixture-a" }));
    expect(s.selection).toEqual(["fixture-a"]);
  });

  it("opens a zone on a second tap", () => {
    const reduce = reducer();
    const s = gesture(reduce, editing({ ...store(), zones: [zone()] }), tap({ kind: "zone", id: "zone-a" }), tap({ kind: "zone", id: "zone-a" }));
    expect(s.focus).toEqual({ kind: "zone", id: "zone-a" });
  });

  it("opens a zone on the first tap of the read-only map", () => {
    const reduce = reducer();
    const s = gesture(reduce, editing({ ...store(), zones: [zone()] }, true), tap({ kind: "zone", id: "zone-a" }));
    expect(s.focus).toEqual({ kind: "zone", id: "zone-a" });
  });
});

describe("drags", () => {
  it("moves a fixture, snapped and committed as one undo step", () => {
    const reduce = reducer();
    const s = gesture(reduce, editing({ ...store(), fixtures: [fixture()] }), ...drag({ kind: "fixture", id: "fixture-a" }, [300, 100], [330, 100]));
    expect(s.layout.fixtures[0].x).toBe(330);
    expect(s.history.past).toHaveLength(1);
    expect(s.preview).toBeNull();
  });

  it("snaps back from an overlapping drop and names the blocker", () => {
    const reduce = reducer();
    const layout = { ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Table 2", x: 400 })] };
    const s = gesture(reduce, editing(layout), ...drag({ kind: "fixture", id: "b" }, [400, 100], [340, 100]));
    expect(s.layout).toBe(layout);
    expect(s.notice).toBe("Blocked by Table 1.");
  });

  it("shows the problem while dragging", () => {
    const reduce = reducer();
    const layout = { ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Table 2", x: 400 })] };
    const [start, move] = drag({ kind: "fixture", id: "b" }, [400, 100], [340, 100]);
    const s = gesture(reduce, editing(layout), start, move);
    expect(s.preview?.issues.map((i) => i.kind)).toContain("overlap");
  });

  it("moves nothing when a pinch cancels the drag", () => {
    const reduce = reducer();
    const layout = { ...store(), fixtures: [fixture()] };
    const [start, move] = drag({ kind: "fixture", id: "fixture-a" }, [300, 100], [330, 100]);
    const s = gesture(reduce, editing(layout), start, move, { type: "dragCancel", target: { kind: "fixture", id: "fixture-a" } });
    expect(s.layout).toBe(layout);
    expect(s.preview).toBeNull();
  });

  it("ignores edits made while a drag is held, so release cannot overwrite them", () => {
    const reduce = reducer();
    const layout = { ...store(), fixtures: [fixture()] };
    const target = { kind: "fixture", id: "fixture-a" } as const;
    const [start, move, end] = drag(target, [300, 100], [330, 100]);
    let s = gesture(reduce, editing(layout), start, move);
    s = reduce({ ...s, selection: ["fixture-a"] }, { type: "nudge", dx: 1, dy: 0 });
    s = reduce(s, { type: "delete" });
    s = gesture(reduce, s, end);
    expect(s.layout.fixtures.map((f) => f.x)).toEqual([330]);
    expect(s.history.past).toHaveLength(1);
  });

  it("changes nothing on release when a rebase removed the fixture being resized", () => {
    const reduce = reducer();
    const base = { ...store(), fixtures: [fixture()], faces: [face()] };
    const target = { kind: "handle", ref: { kind: "resize", fixtureId: "fixture-a", side: "right" } } as const;
    const [start, move, end] = drag(target, [336, 100], [360, 100]);
    let s = gesture(reduce, editing(base), start, move);
    expect(s.preview).not.toBeNull();
    s = reduce(s, { type: "rebase", base, server: { ...base, fixtures: [], faces: [] }, skip: [] });
    s = gesture(reduce, s, end);
    expect(s.layout.fixtures).toEqual([]);
    expect(s.history.past).toHaveLength(0);
  });

  it("box-selects fixtures on desktop", () => {
    const reduce = reducer();
    const layout = { ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Table 2", x: 100, y: 300 })] };
    const s = gesture(reduce, editing(layout), ...drag({ kind: "marquee" }, [250, 50], [350, 150]));
    expect(s.selection).toEqual(["fixture-a"]);
  });
});

describe("drawing a custom outline", () => {
  it("places corners and closes on the first one", () => {
    const reduce = reducer();
    // Starting to draw refits the camera; put it back so screen pixels equal inches.
    let s = { ...reduce(editing(EMPTY_LAYOUT), { type: "startDrawing" }), camera: { x: 0, y: 0, scale: 1 } };
    for (const [x, y] of [[0, 0], [480, 0], [480, 360], [0, 360]]) s = gesture(reduce, s, tap({ kind: "empty" }, x, y));
    s = gesture(reduce, s, tap({ kind: "empty" }, 3, 2));
    expect(s.drawing).toBeNull();
    expect(s.layout.outline?.points).toHaveLength(4);
  });
});

describe("bending a wall bay on the map", () => {
  const bay = fixture({ id: "bay", type: "wall_bay", x: 240, y: 180, width: 120, depth: 24 });
  const front = face({ id: "bay-front", fixtureId: "bay", side: "front", columns: 20, rows: 5 });
  const start = (f = bay): Session => ({
    ...editing({ ...store(), fixtures: [f], faces: [front] }),
    camera: { x: 0, y: 0, scale: 1 },
    selection: ["bay"],
  });

  it("bends it with the pointer, leaving the pose and the grid alone", () => {
    const target: HitTarget = { kind: "handle", ref: { kind: "curve", fixtureId: "bay" } };
    const s = gesture(reducer(), start(), ...drag(target, [240, 192], [240, 222]));
    expect(s.layout.fixtures[0]).toMatchObject({ x: 240, y: 180, width: 120, curve: 30 });
    expect(s.layout.faces[0]).toMatchObject({ columns: 20, rows: 5 });
  });

  it("changes the length, not the curve, from an end of a curved bay", () => {
    const target: HitTarget = { kind: "handle", ref: { kind: "resize", fixtureId: "bay", side: "right" } };
    const s = gesture(reducer(), start({ ...bay, curve: 30 }), ...drag(target, [290, 180], [340, 180]));
    const after = s.layout.fixtures[0];
    expect(after).toMatchObject({ x: 240, y: 180, curve: 30 });
    expect(after.width).toBeGreaterThan(120);
  });
});

describe("dragging a rack near an open end", () => {
  const rack = (id: string, x: number) => fixture({ id, type: "frame_rack", name: id, x, y: 120, width: 48, depth: 24, rotation: 0 });
  const racks = () => editing({ ...store(), fixtures: [rack("a", 100), rack("b", 300)] });
  const target: HitTarget = { kind: "fixture", id: "b" };

  it("shows the join during the drag and offers it on the drop, without linking", () => {
    const reduce = reducer();
    const [start, move, end] = drag(target, [300, 120], [156, 120]);
    const dragging = gesture(reduce, racks(), start, move);
    expect(dragging.preview?.join).toMatchObject({ rackId: "b", targetId: "a", side: "right" });
    const dropped = gesture(reduce, dragging, end);
    expect(dropped.linkOffer).toEqual({ ids: ["b"] });
    expect(dropped.layout.fixtures.every((f) => f.runId === null)).toBe(true);
    expect(dropped.layout.frameRuns).toEqual([]);
  });

  it("offers nothing when dropped far away", () => {
    const s = gesture(reducer(), racks(), ...drag(target, [300, 120], [250, 120]));
    expect(s.linkOffer).toBeNull();
  });

  it("offers nothing when the drop is refused", () => {
    // Within reach of a's end, but overlapping it.
    const s = gesture(reducer(), { ...racks(), snapping: false }, ...drag(target, [300, 120], [140, 120]));
    expect(s.layout.fixtures[1].x).toBe(300);
    expect(s.linkOffer).toBeNull();
  });

  it("drops the offer on the next tap or drag", () => {
    const reduce = reducer();
    const offered = gesture(reduce, racks(), ...drag(target, [300, 120], [156, 120]));
    expect(gesture(reduce, offered, tap({ kind: "empty" })).linkOffer).toBeNull();
    expect(gesture(reduce, offered, { type: "dragStart", target, origin: at(156, 120) }).linkOffer).toBeNull();
  });
});

describe("dragging a wall bay to another bay's end (DECISIONS 11-11)", () => {
  const bay = (id: string, over: object) => fixture({ id, type: "wall_bay", name: id, width: 48, depth: 24, rotation: 0, ...over });
  const curved = bay("c", { x: 200, y: 100, width: 96, curve: -14 });
  const loose = bay("f", { x: 350, y: 250 });
  const end = endsOf(curved).right;
  // Drop f with its left end 6 in past the curved bay's right end.
  const to: [number, number] = [350 + end.at.x + 6 - (350 - 24), 250 + end.at.y - (250 - 12)];

  it("lands on the end, turned to follow the curve, and links nothing by itself", () => {
    const s = gesture(reducer(), editing({ ...store(), fixtures: [curved, loose] }), ...drag({ kind: "fixture", id: "f" }, [350, 250], to));
    const f = s.layout.fixtures[1];
    expect(s.notice).toBeNull();
    const left = endsOf(f).left;
    expect(Math.hypot(left.at.x - end.at.x, left.at.y - end.at.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(left.dir - end.dir)).toBeLessThanOrEqual(0.5);
    expect(f.runId).toBeNull();
    expect(s.history.past).toHaveLength(1);
  });

  it("outlines the bay it meets while dragging, and only moves with snapping off", () => {
    const [start, move, drop] = drag({ kind: "fixture", id: "f" }, [350, 250], to);
    expect(gesture(reducer(), editing({ ...store(), fixtures: [curved, loose] }), start, move).preview?.meets).toBe("c");
    const free = gesture(reducer(), { ...editing({ ...store(), fixtures: [curved, loose] }), snapping: false }, start, move, drop);
    expect(free.layout.fixtures[1].rotation).toBe(0);
  });
});

describe("Select more", () => {
  const two = () => editing({ ...store(), fixtures: [fixture({ id: "a" }), fixture({ id: "b", x: 300 })] });
  const a: HitTarget = { kind: "fixture", id: "a" };
  const b: HitTarget = { kind: "fixture", id: "b" };
  const longPress = (target: HitTarget): GestureEffect<HitTarget> => ({ type: "longPress", target, point: at(0, 0) });

  it("starts on a long-press, and taps then add and remove", () => {
    const reduce = reducer();
    const s = gesture(reduce, two(), longPress(a), tap(b));
    expect(s.selection).toEqual(["a", "b"]);
    expect(s.selectingMore).toBe(true);
    expect(gesture(reduce, s, tap(a)).selection).toEqual(["b"]);
  });

  it("does not start on a long-press of empty floor", () => {
    expect(gesture(reducer(), two(), longPress({ kind: "empty" })).selectingMore).toBe(false);
  });

  it("ends on Done, and a tap selects one thing again", () => {
    const reduce = reducer();
    const s = reduce(gesture(reduce, two(), longPress(a)), { type: "selectMore", on: false });
    expect(gesture(reduce, s, tap(b)).selection).toEqual(["b"]);
  });

  it("ends when the selection empties, so the next tap picks one thing", () => {
    const reduce = reducer();
    const s = gesture(reduce, two(), longPress(a), tap(a), tap(b), tap(a));
    expect(s.selection).toEqual(["a"]);
    expect(s.selectingMore).toBe(false);
  });

  it("ends on a tap of empty floor", () => {
    const s = gesture(reducer(), two(), longPress(a), tap({ kind: "empty" }));
    expect(s.selection).toEqual([]);
    expect(s.selectingMore).toBe(false);
  });
});
