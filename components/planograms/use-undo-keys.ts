// Ctrl+Z and Ctrl+Shift+Z (Cmd on a Mac) for the builder, outside text fields and dialogs.

"use client";

import { useEffect } from "react";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable], [role=dialog]") !== null;

export function useUndoKeys(enabled: boolean, travel: (direction: "undo" | "redo") => void) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "z" || isTyping(event.target)) return;
      event.preventDefault();
      travel(event.shiftKey ? "redo" : "undo");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
