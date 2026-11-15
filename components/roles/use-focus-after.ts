// Where focus goes after something on the Roles screen changes the page (spec 0.7, 4.8 part 8).
// The element may not exist yet (a row that moves or is added shows up when the reloaded view
// arrives), so the screen names it and the hook focuses it after the next render that has it.
// Both the table and the phone folds are in the page, one hidden by CSS: the first visible match wins.

"use client";

import { useEffect, useRef } from "react";

const visible = (el: HTMLElement) => el.getClientRects().length > 0;

export function useFocusAfter() {
  const pending = useRef<string | null>(null);
  const titleArmed = useRef(false);

  // Every render: it only acts while something is pending, and a match may arrive a render later.
  useEffect(() => {
    if (pending.current === null) return;
    const found = [...document.querySelectorAll<HTMLElement>(pending.current)].find(visible);
    if (!found) return;
    pending.current = null;
    found.focus();
  });

  return {
    /** Focus the first visible element matching `selector` once it is in the page. */
    focusAfter(selector: string | null) {
      pending.current = selector;
    },
    /** A deleted row is gone, so focus goes to the page title (it takes focus only by script). */
    armTitle() {
      titleArmed.current = true;
    },
    /** True when the title took focus, so the dialog should not send it back to its opener. */
    takeTitle(): boolean {
      if (!titleArmed.current) return false;
      titleArmed.current = false;
      const title = document.querySelector<HTMLElement>("h1");
      title?.setAttribute("tabindex", "-1");
      title?.focus();
      return true;
    },
  };
}
