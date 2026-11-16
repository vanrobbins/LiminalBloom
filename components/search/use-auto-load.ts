// Loads the next page when the end of the list scrolls into view (0.7.0.5 spec 3.4). Returns
// the ref for a sentinel at the list end. `enabled` is false while a page is loading, after a
// failure and when there is no next page: no observer exists then, so nothing double-fires.
// Turning back on makes a fresh observer, which reports at once, so a list still too short to
// scroll keeps filling. The worded Load more button is the fallback for everyone else.

"use client";

import { useEffect, useRef } from "react";

export function useAutoLoad(enabled: boolean, load: () => void) {
  const sentinel = useRef<HTMLDivElement>(null);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    const end = sentinel.current;
    if (!enabled || !end || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current();
      },
      // A little early, so the next page is usually there before the end is.
      { rootMargin: "200px 0px" },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinel;
}
