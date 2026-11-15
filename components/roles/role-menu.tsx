// The ⋯ menu at the end of a role's row (spec 0.7, 4.8 part 4). Only items that apply are
// there. While permissions are staged it is switched off with a reason, so a rename or a
// delete can't be mixed up with unsaved edits. Dialogs open from the screen's state, so the
// item hands over the trigger to return focus to.

"use client";

import { Ellipsis } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { RoleAction, RoleRow } from "@/lib/access/roles-view";

type RoleMenuProps = {
  row: RoleRow;
  actions: { key: RoleAction; label: string }[];
  /** Set while permissions are staged: why the menu is off. */
  disabledHint: string | null;
  onAction: (row: RoleRow, action: RoleAction, opener: HTMLElement) => void;
};

export function RoleMenu({ row, actions, disabledHint, onAction }: RoleMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  if (actions.length === 0) return null;
  return (
    // Not modal: a modal menu closing as a dialog opens can leave the page unclickable.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} variant="secondary" icon aria-label={`More for ${row.name}`} data-role-menu={row.id} disabled={disabledHint !== null} title={disabledHint ?? undefined}>
          <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a) => (
          <DropdownMenuItem key={a.key} onSelect={() => trigger.current && onAction(row, a.key, trigger.current)}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
