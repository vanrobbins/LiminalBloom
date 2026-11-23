// A paused store as a small pill: icon and word, never colour alone (§5.5).

import { CirclePause } from "lucide-react";

export function PausedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info-tint px-2.5 py-0.5 text-sm font-medium text-info">
      <CirclePause aria-hidden="true" strokeWidth={1.75} className="size-4" />
      Paused
    </span>
  );
}
