// The due date's editor (spec §4.4): a small sheet on phones, a dialog elsewhere.
// Opened by the chip (a date is set) or by Set due date in the corner bar's ⋯.

"use client";

import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog } from "@/components/ui/dialog";

import { DueDateForm } from "./due-date-field";

type DueDateEditorProps = {
  fixtureId: string;
  dueDate: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close when the opener is gone (a menu item). */
  onCloseAutoFocus?: (event: Event) => void;
};

export function DueDateEditor({ fixtureId, dueDate, open, onOpenChange, onCloseAutoFocus }: DueDateEditorProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  // Not "Due date": that is the field's label inside (B9).
  const title = dueDate ? "Change due date" : "Set due date";
  const form = open ? <DueDateForm key={dueDate ?? "none"} fixtureId={fixtureId} dueDate={dueDate} onDone={() => onOpenChange(false)} /> : null;
  return isPhone ? (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} onCloseAutoFocus={onCloseAutoFocus}>
      {form}
    </BottomSheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} onCloseAutoFocus={onCloseAutoFocus}>
      {form}
    </Dialog>
  );
}
