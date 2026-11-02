// A numbered dot on a mock screen. Tapping it lights the matching point in
// the text; it lights in gold when that point is chosen there.

"use client";

import { usePoint } from "./point-context";

export function Marker({ n }: { n: number }) {
  const { active, choose } = usePoint();
  const isActive = active === n;

  return (
    <button
      type="button"
      aria-label={`Point ${n}`}
      aria-pressed={isActive}
      onClick={() => choose(n)}
      className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-surface bg-ink font-mono text-xs font-medium text-surface before:absolute before:-inset-2.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-brand aria-pressed:text-on-brand"
    >
      {n}
    </button>
  );
}
