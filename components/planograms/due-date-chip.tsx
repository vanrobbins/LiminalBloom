// The due date as a chip in the status row (spec §4.4): "Due Oct 14",
// "Overdue · Oct 9" (with an icon, never colour alone) or "Set due date".
// Opens a small sheet on phones, a dialog elsewhere.

"use client";

import { AlertTriangle, CalendarDays } from "lucide-react";
import { useState } from "react";

import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog } from "@/components/ui/dialog";
import { dueLabel } from "@/lib/planograms/dates";

import { DueDateForm } from "./due-date-field";

type DueDateChipProps = { fixtureId: string; dueDate: string | null; today: string };

export function DueDateChip({ fixtureId, dueDate, today }: DueDateChipProps) {
  const [open, setOpen] = useState(false);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const label = dueDate ? dueLabel(dueDate, today) : null;
  const Icon = label?.overdue ? AlertTriangle : CalendarDays;
  const form = open ? <DueDateForm key={dueDate ?? "none"} fixtureId={fixtureId} dueDate={dueDate} onDone={() => setOpen(false)} /> : null;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-overdue={label?.overdue ? "" : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm whitespace-nowrap text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-overdue:border-danger data-overdue:text-danger"
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        {label ? label.text : "Set due date"}
      </button>
      {isPhone ? (
        <BottomSheet open={open} onOpenChange={setOpen} title="Due date">
          {form}
        </BottomSheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen} title="Due date">
          {form}
        </Dialog>
      )}
    </>
  );
}
