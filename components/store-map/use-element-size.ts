// Reports an element's size whenever it changes, so the camera always knows
// the viewport it draws into (spec §4).

"use client";

import { useEffect, useRef } from "react";

import type { Viewport } from "@/lib/layout/camera";

export function useElementSize<T extends HTMLElement>(onSize: (viewport: Viewport) => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      onSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onSize]);
  return ref;
}
