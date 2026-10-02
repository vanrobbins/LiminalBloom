// The single place pointer events are read (spec §10). Everything is fed to
// the gesture state machine (lib/layout/gesture.ts), which decides what each
// press means; this hook only translates DOM events into its terms.

"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  IDLE,
  LONG_PRESS_MS,
  step,
  type GestureEffect,
  type GestureEvent,
  type GestureState,
  type PointerKind,
} from "@/lib/layout/gesture";
import type { HitTarget } from "@/lib/layout/hit-test";
import type { Point } from "@/lib/layout/types";

type PointerOptions = {
  hit: (screen: Point, shift: boolean) => HitTarget;
  canDrag: (target: HitTarget) => boolean;
  onEffect: (effect: GestureEffect<HitTarget>) => void;
  onWheel: (wheel: { screen: Point; dx: number; dy: number; zoom: boolean }) => void;
  onHover?: (screen: Point) => void;
};

/**
 * A field still being typed in commits on blur, but a touch on the map selects
 * on pointerup before the field blurs (and iOS may not blur at all), so the
 * typed value would land on the wrong item or be lost. Blur it first.
 */
function blurTypingField() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (active.matches("input, textarea, select") || active.isContentEditable) active.blur();
}

export function usePointerInput(options: PointerOptions) {
  const svg = useRef<SVGSVGElement>(null);
  const state = useRef<GestureState<HitTarget>>(IDLE);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
  });

  function local(event: { clientX: number; clientY: number }): Point {
    const box = svg.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  }

  function feed(event: GestureEvent<HitTarget>) {
    const result = step(state.current, event, latest.current.canDrag);
    state.current = result.state;
    for (const effect of result.effects) latest.current.onEffect(effect);
  }

  useEffect(() => {
    const found = svg.current;
    if (!found) return;
    const element: SVGSVGElement = found; // narrowed copy: function declarations lose the null check
    // Native and non-passive, so the page does not scroll or zoom under the map.
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      latest.current.onWheel({
        screen: { x: event.clientX - box.left, y: event.clientY - box.top },
        dx: event.deltaX,
        dy: event.deltaY,
        zoom: event.ctrlKey || event.metaKey,
      });
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handlers = {
    ref: svg,
    onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      blurTypingField();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = local(event);
      feed({
        type: "down",
        id: event.pointerId,
        point,
        time: event.timeStamp,
        kind: event.pointerType as PointerKind,
        shift: event.shiftKey,
        target: latest.current.hit(point, event.shiftKey),
      });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => feed({ type: "timer", time: performance.now() }), LONG_PRESS_MS);
    },
    onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
      const point = local(event);
      latest.current.onHover?.(point);
      feed({ type: "move", id: event.pointerId, point, time: event.timeStamp });
    },
    onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
      feed({ type: "up", id: event.pointerId, point: local(event), time: event.timeStamp });
    },
    onPointerCancel(event: React.PointerEvent<SVGSVGElement>) {
      feed({ type: "cancel", id: event.pointerId });
    },
    onLostPointerCapture(event: React.PointerEvent<SVGSVGElement>) {
      // Fires after a normal pointerup too; the state machine ignores ids it has finished with.
      feed({ type: "cancel", id: event.pointerId });
    },
  };

  /** For Escape: forget whatever press is in progress. Stable, so key listeners stay attached. */
  const reset = useCallback(() => {
    state.current = IDLE;
    window.clearTimeout(timer.current);
  }, []);

  return { handlers, reset };
}
