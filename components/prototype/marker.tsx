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
      // The button is the 44 px touch target; the negative margin keeps it
      // taking only the dot's 24 px in the drawing's layout.
      className="group -m-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-ink"
    >
      <span className="inline-flex size-6 items-center justify-center rounded-full border-2 border-surface bg-ink font-mono text-xs font-medium text-surface group-aria-pressed:bg-brand group-aria-pressed:text-on-brand">
        {n}
      </span>
    </button>
  );
}
