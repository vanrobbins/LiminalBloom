// A list row that folds shut when it leaves (0.7.0.5 spec §3.1): a grid whose one row
// goes 1fr to 0fr over 190 ms, so the rows below slide up. The padding lives inside
// the clipped box, or it would hold the row open. `leaving` also makes it inert, so a
// folding row can't be pressed. Motion only where `motion-safe`.

import type { ReactNode } from "react";

export function CollapseItem({ leaving = false, className = "", children }: { leaving?: boolean; className?: string; children: ReactNode }) {
  return (
    <li inert={leaving} className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-[190ms] motion-safe:ease-[var(--ease-exit)] ${leaving ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </li>
  );
}
