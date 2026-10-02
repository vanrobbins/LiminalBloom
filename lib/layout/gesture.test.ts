import { describe, expect, it } from "vitest";

import { IDLE, step, type GestureEffect, type GestureEvent, type GestureState } from "./gesture";

type Target = "item" | "empty";
const canDrag = (t: Target) => t === "item";

type Outcome = { state: GestureState<Target>; effects: GestureEffect<Target>[] };

function run(events: GestureEvent<Target>[]): Outcome {
  let state: GestureState<Target> = IDLE;
  const effects: GestureEffect<Target>[] = [];
  for (const event of events) {
    const result: Outcome = step(state, event, canDrag);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const down = (id: number, x: number, y: number, target: Target = "item", time = 0, kind: "touch" | "mouse" = "touch"): GestureEvent<Target> => ({
  type: "down",
  id,
  point: { x, y },
  time,
  kind,
  shift: false,
  target,
});
const move = (id: number, x: number, y: number, time = 10): GestureEvent<Target> => ({ type: "move", id, point: { x, y }, time });
const up = (id: number, x: number, y: number, time = 20): GestureEvent<Target> => ({ type: "up", id, point: { x, y }, time });

const types = (effects: GestureEffect<Target>[]) => effects.map((e) => e.type);

describe("one pointer", () => {
  it("is a tap if it barely moves", () => {
    expect(types(run([down(1, 0, 0), move(1, 5, 0), up(1, 5, 0)]).effects)).toEqual(["tap"]);
  });

  it("drags an item once it passes the slop", () => {
    const { effects, state } = run([down(1, 0, 0), move(1, 9, 0), move(1, 20, 0), up(1, 20, 0)]);
    expect(types(effects)).toEqual(["dragStart", "drag", "drag", "dragEnd"]);
    expect(state).toEqual(IDLE);
  });

  it("uses a smaller slop for a mouse", () => {
    expect(types(run([down(1, 0, 0, "item", 0, "mouse"), move(1, 5, 0)]).effects)).toEqual(["dragStart", "drag"]);
  });

  it("pans on empty space", () => {
    const { effects } = run([down(1, 0, 0, "empty"), move(1, 10, 0), move(1, 15, 5)]);
    expect(effects).toEqual([
      { type: "pan", dx: 10, dy: 0 },
      { type: "pan", dx: 5, dy: 5 },
    ]);
  });

  it("long-presses after 500 ms held still, and never also taps", () => {
    const { effects } = run([down(1, 0, 0), { type: "timer", time: 500 }, up(1, 0, 0, 600)]);
    expect(types(effects)).toEqual(["longPress"]);
  });

  it("does not long-press once the finger has moved off", () => {
    const { effects } = run([down(1, 0, 0), move(1, 20, 0), { type: "timer", time: 500 }]);
    expect(types(effects)).toEqual(["dragStart", "drag"]);
  });

  it("each drag move is from the origin, never added up", () => {
    const { effects } = run([down(1, 0, 0), move(1, 10, 0), move(1, 30, 0)]);
    const last = effects.at(-1);
    expect(last).toEqual({ type: "drag", target: "item", origin: { x: 0, y: 0 }, point: { x: 30, y: 0 } });
  });
});

describe("two pointers", () => {
  it("a second finger mid-drag cancels the drag and pinches", () => {
    const { effects } = run([down(1, 0, 0), move(1, 20, 0), down(2, 100, 0), move(2, 120, 0)]);
    expect(types(effects)).toEqual(["dragStart", "drag", "dragCancel", "pinch"]);
  });

  it("pinch reports the zoom factor and how far the centre moved", () => {
    const { effects } = run([down(1, 0, 0), down(2, 100, 0), move(2, 200, 0)]);
    expect(effects.at(-1)).toEqual({ type: "pinch", center: { x: 100, y: 0 }, factor: 2, dx: 50, dy: 0 });
  });

  it("lifting one finger after a pinch does nothing until both are up", () => {
    const { effects, state } = run([down(1, 0, 0), down(2, 100, 0), up(2, 100, 0), move(1, 50, 0), up(1, 50, 0)]);
    expect(effects).toEqual([]);
    expect(state).toEqual(IDLE);
  });
});

describe("cancel", () => {
  it("cancels a drag", () => {
    expect(types(run([down(1, 0, 0), move(1, 20, 0), { type: "cancel", id: 1 }]).effects)).toEqual(["dragStart", "drag", "dragCancel"]);
  });

  it("ignores pointers it does not know", () => {
    expect(run([move(9, 1, 1), up(9, 1, 1)]).effects).toEqual([]);
  });
});
