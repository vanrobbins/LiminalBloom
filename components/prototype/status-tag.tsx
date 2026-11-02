// A chapter's standing: a word and an icon, so it reads without colour.
// Gold stays off it: gold is never a status (§5.5).

import { CalendarClock, CircleCheck, Hammer, Info } from "lucide-react";

import { STATUS_LABEL } from "@/lib/prototype/chapters";
import type { ChapterStatus } from "@/lib/prototype/types";

const LOOK: Record<ChapterStatus, { icon: typeof Info; tone: string }> = {
  about: { icon: Info, tone: "bg-line-subtle text-ink" },
  live: { icon: CircleCheck, tone: "bg-ok-tint text-ok" },
  next: { icon: Hammer, tone: "bg-info-tint text-info" },
  planned: { icon: CalendarClock, tone: "bg-line-subtle text-ink-muted" },
};

export function StatusTag({ status }: { status: ChapterStatus }) {
  const { icon: Icon, tone } = LOOK[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${tone}`}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {STATUS_LABEL[status]}
    </span>
  );
}
