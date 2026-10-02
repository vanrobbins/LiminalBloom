import { describe, expect, it } from "vitest";

import type { GestureEffect } from "./gesture";
import type { HitTarget } from "./hit-test";
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
