// A row that leaves the list folds shut first (0.7.0.5 spec §3.1): the screen marks it
// leaving, CollapseItem animates, and the refresh that drops it from the data waits
// until the fold is done (with reduced motion there is no fold, so no wait). If that
// refresh fails, the row opens again and the screen is told.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const COLLAPSE_MS = 190;

export function useCollapseOut() {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const held = timers.current;
    return () => held.forEach(clearTimeout);
  }, []);

  /** Starts `id` folding; `then` (the refresh that removes it) runs when the fold is over. If it throws or rejects the row opens again and `onFail` runs. */
  const collapse = useCallback((id: string, then: () => void | Promise<void>, onFail?: () => void) => {
    const unfold = () => {
      setLeaving((now) => {
        const next = new Set(now);
        next.delete(id);
        return next;
      });
      onFail?.();
    };
    setLeaving((now) => new Set(now).add(id));
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      try {
        Promise.resolve(then()).catch(unfold);
      } catch {
        unfold();
      }
    }, reduced ? 0 : COLLAPSE_MS);
    timers.current.add(timer);
  }, []);

  return { isLeaving: (id: string) => leaving.has(id), collapse };
}
