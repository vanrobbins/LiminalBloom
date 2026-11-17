// The corner bar's ⋯ (0.7.0.5): Set or Change due date, which opens the date
// editor, and Version history. Nothing to offer (no publish switch, never
// published) and there is no ⋯.

"use client";

import { CalendarDays, History, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { DueDateEditor } from "./due-date-editor";

const ICON = {
  "aria-hidden": true,
  strokeWidth: 1.75,
  className: "size-4",
} as const;

type CornerMenuProps = {
  fixtureId: string;
  dueDate: string | null;
  canSetDueDate: boolean;
  hasHistory: boolean;
};

export function CornerMenu({ fixtureId, dueDate, canSetDueDate, hasHistory }: CornerMenuProps) {
  const [editing, setEditing] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  if (!canSetDueDate && !hasHistory) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={more} variant="secondary" icon aria-label="More actions">
            <MoreHorizontal aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end">
          {canSetDueDate ? (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <CalendarDays {...ICON} />
              {dueDate ? "Change due date" : "Set due date"}
            </DropdownMenuItem>
          ) : null}
          {hasHistory ? (
            <DropdownMenuItem asChild>
              <Link href={`/planograms/${fixtureId}/history`}>
                <History {...ICON} />
                Version history
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canSetDueDate ? (
        <DueDateEditor
          fixtureId={fixtureId}
          dueDate={dueDate}
          open={editing}
          onOpenChange={setEditing}
          // The menu item it opened from is gone: focus goes back to the ⋯.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            more.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
