// Which layout the editor is in (spec §10): phone sheets below 768 px.
// useSyncExternalStore keeps it right through resizes without effects.

"use client";

import { useSyncExternalStore } from "react";

export const PHONE_QUERY = "(max-width: 767px)";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
