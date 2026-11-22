import { describe, expect, it } from "vitest";

import type { GestureEffect } from "./gesture";
import type { HitTarget } from "./hit-test";
import { endsOf } from "./runs";
import type { Session } from "./session-core";
import { fixture, store } from "./test-layouts";
import { editing, reducer } from "./test-sessions";

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
