// A request's status in words and an icon, never colour alone (CODESTYLE accessibility 4): Waiting, Replied, Closed.

import { CircleCheck, Clock, MessageCircleReply } from "lucide-react";

import { type HelpStatus, STATUS_LABEL } from "@/lib/help/kinds";

const ICON = { open: Clock, answered: MessageCircleReply, closed: CircleCheck } as const;

export function HelpStatusWord({ status }: { status: HelpStatus }) {
  const Icon = ICON[status];
  return (
    <span data-help-status={status} className={`inline-flex items-center gap-1 text-sm ${status === "answered" ? "font-semibold text-ink" : "text-ink-muted"}`}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {STATUS_LABEL[status]}
    </span>
  );
}
