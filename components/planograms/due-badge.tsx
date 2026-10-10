// A due date in words, overdue with an icon too (status is never color alone).

import { AlertTriangle } from "lucide-react";

import { dueLabel } from "@/lib/planograms/dates";

export function DueBadge({ dueDate, today }: { dueDate: string; today: string }) {
  const { text, overdue } = dueLabel(dueDate, today);
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${overdue ? "text-danger" : "text-ink-muted"}`}>
      {overdue ? <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
      {text}
    </span>
  );
}
