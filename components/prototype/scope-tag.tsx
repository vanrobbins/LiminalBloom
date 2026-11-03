// Where a chapter sits in the proposal's scope: a word and an icon, so it
// reads without colour. Gold stays off it: gold is never a status (§5.5).

import { CalendarClock, CircleCheck, CircleDashed } from "lucide-react";

import { SCOPE_LABEL } from "@/lib/prototype/chapters";
import type { ChapterScope } from "@/lib/prototype/types";

const LOOK: Record<ChapterScope, { icon: typeof CircleCheck; tone: string }> = {
  included: { icon: CircleCheck, tone: "bg-ok-tint text-ok" },
  planned: { icon: CalendarClock, tone: "bg-info-tint text-info" },
  nice: { icon: CircleDashed, tone: "bg-line-subtle text-ink-muted" },
};

export function ScopeTag({ scope }: { scope: ChapterScope }) {
  const { icon: Icon, tone } = LOOK[scope];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${tone}`}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {SCOPE_LABEL[scope]}
    </span>
  );
}
