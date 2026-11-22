// The palette's two global openers (spec §2). Ctrl/Cmd+K toggles it, even while typing in a
// field (a modifier combination is not typing), and always stops the browser's own Ctrl+K.
// `/` only opens, and only when focus is not somewhere text goes. Neither opens over another
// modal: a second focus trap over a delete confirmation or a sheet would strand the person.

"use client";

import { useEffect } from "react";

// The palette's own dialog carries data-palette, so it never counts as "another".
const OTHER_MODAL = '[role="dialog"]:not([data-palette]), [role="alertdialog"], [role="menu"]';

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function usePaletteKeys(isOpen: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Held keys and IME composition (keyCode 229 on browsers that don't set isComposing) are not shortcuts.
      if (event.repeat || event.isComposing || event.keyCode === 229) return;
      const blocked = document.querySelector(OTHER_MODAL) !== null;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) setOpen(false);
        else if (!blocked) setOpen(true);
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isOpen && !blocked && !typingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);
}
