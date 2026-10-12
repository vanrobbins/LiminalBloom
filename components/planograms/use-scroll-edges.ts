// Whether a sideways-scrolling box has more to show on each side: drives the
// fade on the clipped edge and tells a swipe whether to scroll or switch face.

"use client";

import { useEffect, useRef, useState } from "react";

export type Edges = { left: boolean; right: boolean };

/** `watch` changes when the content element is replaced (e.g. a keyed remount), so it is observed afresh. */
export function useScrollEdges<T extends HTMLElement>(watch?: unknown) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState<Edges>({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      const next = { left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
      setEdges((current) => (current.left === next.left && current.right === next.right ? current : next));
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    // A slide-in is transient overflow; nothing else fires when it ends.
    el.addEventListener("animationend", update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("animationend", update);
      observer.disconnect();
    };
  }, [watch]);

  return { ref, edges };
}
