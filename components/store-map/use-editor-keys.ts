// Desktop shortcuts (spec §7). Ignored while a text field has focus, so
// typing a name never deletes a fixture.

"use client";

import { useEffect } from "react";

import type { SessionAction } from "@/lib/layout/session";

const NUDGE = 1;
const BIG_NUDGE = 12;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function useEditorKeys(dispatch: (action: SessionAction) => void, resetGesture: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isTyping(event.target)) return;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (command && key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (command && key === "d") {
        event.preventDefault();
        dispatch({ type: "duplicate" });
        return;
      }
      if (command) return;

      const step = event.shiftKey ? BIG_NUDGE : NUDGE;
      const nudges: Record<string, [number, number]> = {
        arrowleft: [-step, 0],
        arrowright: [step, 0],
        arrowup: [0, -step],
        arrowdown: [0, step],
      };
      if (key in nudges) {
        event.preventDefault();
        const [dx, dy] = nudges[key];
        dispatch({ type: "nudge", dx, dy });
      } else if (key === "r") {
        dispatch({ type: "rotate", by: event.shiftKey ? -15 : 15 });
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        dispatch({ type: "delete" });
      } else if (key === "escape") {
        resetGesture();
        dispatch({ type: "escape" });
      } else if (key === "f") {
        dispatch({ type: "fit" });
      } else if (key === "alt") {
        dispatch({ type: "snapping", on: false });
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") dispatch({ type: "snapping", on: true });
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Alt released while another window had focus never sends a keyup here.
    const onBlur = () => dispatch({ type: "snapping", on: true });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [dispatch, resetGesture]);
}
