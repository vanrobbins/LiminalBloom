// One state machine for every pointer on the map (spec §7). Each stream of
// pointer events ends in exactly one outcome: a tap, a long-press, a drag, a
// pan or a pinch. A move is never applied twice, and a tap and a long-press
// never both fire. Those were Merch Mobile's "double-delta move" and
// "long-press re-adds the point" bugs. Driven by plain events with
// timestamps, so it is tested without a browser.

import type { Point } from "./types";

export type PointerKind = "mouse" | "touch" | "pen";

export const LONG_PRESS_MS = 500;
/** How far a press may wander and still be a tap: fingers are less precise than a mouse. */
export const SLOP: Record<PointerKind, number> = { mouse: 4, touch: 8, pen: 8 };

export type GestureEvent<T> =
  | { type: "down"; id: number; point: Point; time: number; kind: PointerKind; shift: boolean; target: T }
  | { type: "move"; id: number; point: Point; time: number }
  | { type: "up"; id: number; point: Point; time: number }
  | { type: "cancel"; id: number }
  | { type: "timer"; time: number };

export type GestureEffect<T> =
  | { type: "tap"; target: T; point: Point; shift: boolean }
  | { type: "longPress"; target: T; point: Point }
  | { type: "dragStart"; target: T; origin: Point }
  | { type: "drag"; target: T; origin: Point; point: Point }
  | { type: "dragEnd"; target: T; origin: Point; point: Point }
  | { type: "dragCancel"; target: T }
  | { type: "pan"; dx: number; dy: number }
  | { type: "pinch"; center: Point; factor: number; dx: number; dy: number };

export type GestureState<T> =
  | { mode: "idle" }
  | { mode: "pressed"; id: number; origin: Point; current: Point; time: number; kind: PointerKind; shift: boolean; target: T }
  | { mode: "dragging"; id: number; origin: Point; current: Point; target: T }
  | { mode: "panning"; id: number; current: Point }
  | { mode: "pinching"; points: ReadonlyMap<number, Point> }
  | { mode: "settling"; ids: ReadonlySet<number> };

type Result<T> = { state: GestureState<T>; effects: GestureEffect<T>[] };

export const IDLE = { mode: "idle" } as const;

const stay = <T>(state: GestureState<T>): Result<T> => ({ state, effects: [] });

export function step<T>(state: GestureState<T>, event: GestureEvent<T>, canDrag: (target: T) => boolean): Result<T> {
  switch (state.mode) {
    case "idle":
      return event.type === "down"
        ? stay({ mode: "pressed", id: event.id, origin: event.point, current: event.point, time: event.time, kind: event.kind, shift: event.shift, target: event.target })
        : stay(state);
    case "pressed":
      return fromPressed(state, event, canDrag);
    case "dragging":
      return fromDragging(state, event);
    case "panning":
      return fromPanning(state, event);
    case "pinching":
      return fromPinching(state, event);
    case "settling":
      return fromSettling(state, event);
  }
}

/** A second finger turns any one-finger gesture into a pinch. */
function startPinch<T>(first: { id: number; current: Point }, event: { id: number; point: Point }): GestureState<T> {
  return { mode: "pinching", points: new Map([[first.id, first.current], [event.id, event.point]]) };
}

function fromPressed<T>(
  state: Extract<GestureState<T>, { mode: "pressed" }>,
  event: GestureEvent<T>,
  canDrag: (target: T) => boolean,
): Result<T> {
  if (event.type === "down") {
    return event.id === state.id ? stay(state) : stay(startPinch(state, event));
  }
  if (event.type === "timer") {
    return event.time - state.time >= LONG_PRESS_MS
      ? { state: { mode: "settling", ids: new Set([state.id]) }, effects: [{ type: "longPress", target: state.target, point: state.current }] }
      : stay(state);
  }
  // From here the event is a move, up or cancel, and each carries a pointer id.
  if (event.id !== state.id) return stay(state);
  if (event.type === "cancel") return stay(IDLE);
  if (event.type === "up") {
    return { state: IDLE, effects: [{ type: "tap", target: state.target, point: event.point, shift: state.shift }] };
  }
  const travelled = Math.hypot(event.point.x - state.origin.x, event.point.y - state.origin.y);
  if (travelled <= SLOP[state.kind]) return stay({ ...state, current: event.point });
  if (canDrag(state.target)) {
    return {
      state: { mode: "dragging", id: state.id, origin: state.origin, current: event.point, target: state.target },
      effects: [
        { type: "dragStart", target: state.target, origin: state.origin },
        { type: "drag", target: state.target, origin: state.origin, point: event.point },
      ],
    };
  }
  return {
    state: { mode: "panning", id: state.id, current: event.point },
    effects: [{ type: "pan", dx: event.point.x - state.origin.x, dy: event.point.y - state.origin.y }],
  };
}

function fromDragging<T>(state: Extract<GestureState<T>, { mode: "dragging" }>, event: GestureEvent<T>): Result<T> {
  if (event.type === "down" && event.id !== state.id) {
    return { state: startPinch(state, event), effects: [{ type: "dragCancel", target: state.target }] };
  }
  if (event.type === "timer" || event.id !== state.id) return stay(state);
  switch (event.type) {
    case "move":
      return {
        state: { ...state, current: event.point },
        effects: [{ type: "drag", target: state.target, origin: state.origin, point: event.point }],
      };
    case "up":
      return { state: IDLE, effects: [{ type: "dragEnd", target: state.target, origin: state.origin, point: event.point }] };
    case "cancel":
      return { state: IDLE, effects: [{ type: "dragCancel", target: state.target }] };
    default:
      return stay(state);
  }
}

function fromPanning<T>(state: Extract<GestureState<T>, { mode: "panning" }>, event: GestureEvent<T>): Result<T> {
  if (event.type === "down" && event.id !== state.id) return stay(startPinch(state, event));
  if (event.type === "timer" || event.id !== state.id) return stay(state);
  if (event.type === "move") {
    return {
      state: { ...state, current: event.point },
      effects: [{ type: "pan", dx: event.point.x - state.current.x, dy: event.point.y - state.current.y }],
    };
  }
  return event.type === "up" || event.type === "cancel" ? stay(IDLE) : stay(state);
}

function fromPinching<T>(state: Extract<GestureState<T>, { mode: "pinching" }>, event: GestureEvent<T>): Result<T> {
  if (event.type === "timer" || event.type === "down" || !state.points.has(event.id)) return stay(state);
  if (event.type === "up" || event.type === "cancel") {
    const rest = new Set([...state.points.keys()].filter((id) => id !== event.id));
    return stay(rest.size > 0 ? { mode: "settling", ids: rest } : IDLE);
  }
  const [a, b] = [...state.points.values()];
  const next = new Map(state.points).set(event.id, event.point);
  const [c, d] = [...next.values()];
  const before = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const after = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
  const spanBefore = Math.hypot(a.x - b.x, a.y - b.y);
  const spanAfter = Math.hypot(c.x - d.x, c.y - d.y);
  return {
    state: { mode: "pinching", points: next },
    effects: [
      {
        type: "pinch",
        center: after,
        factor: spanBefore > 0 ? spanAfter / spanBefore : 1,
        dx: after.x - before.x,
        dy: after.y - before.y,
      },
    ],
  };
}

/** After a long-press or a pinch: ignore everything until every finger is up. */
function fromSettling<T>(state: Extract<GestureState<T>, { mode: "settling" }>, event: GestureEvent<T>): Result<T> {
  if (event.type === "down") return stay({ mode: "settling", ids: new Set([...state.ids, event.id]) });
  if (event.type === "up" || event.type === "cancel") {
    const rest = new Set([...state.ids].filter((id) => id !== event.id));
    return stay(rest.size > 0 ? { mode: "settling", ids: rest } : IDLE);
  }
  return stay(state);
}
