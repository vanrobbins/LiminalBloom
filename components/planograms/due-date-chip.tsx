// The due date as a chip in the status row (spec §4.4), only once one is set:
// "Due Oct 14", or "Overdue · Oct 9" (with an icon, never colour alone). With
// none set there is no chip; Set due date lives in the corner bar's ⋯.
// Pressing the chip opens the date editor (due-date-editor.tsx).

"use client";

import { AlertTriangle, CalendarDays } from "lucide-react";
import { useState } from "react";

import { dueLabel } from "@/lib/planograms/dates";

import { DueDateEditor } from "./due-date-editor";

type DueDateChipProps = {
  fixtureId: string;
  dueDate: string | null;
  today: string;
  canEdit: boolean;
};

const CHIP =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm whitespace-nowrap text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-overdue:border-danger data-overdue:text-danger";

export function DueDateChip({ fixtureId, dueDate, today, canEdit }: DueDateChipProps) {
  const [open, setOpen] = useState(false);
  if (!dueDate) return null;
  const label = dueLabel(dueDate, today);
  const Icon = label.overdue ? AlertTriangle : CalendarDays;
  const content = (
    <>
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {label.text}
    </>
  );

  // Not theirs to set: the date stays visible, as plain text.
  if (!canEdit) {
    return (
      <span data-overdue={label.overdue ? "" : undefined} className={CHIP}>
        {content}
      </span>
    );
  }

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} data-overdue={label.overdue ? "" : undefined} className={CHIP}>
        {content}
      </button>
      <DueDateEditor fixtureId={fixtureId} dueDate={dueDate} open={open} onOpenChange={setOpen} />
    </>
  );
}
