// The ⋯ menu at the end of a /company row (spec 0.7.1 6.2): a small set of named actions. The trigger is handed to
// the action so a dialog it opens can give focus back to it. No actions, no menu: a row the person can do nothing
// with is read-only. Not modal: a modal menu closing as a dialog opens can leave the page unclickable.

"use client";

import { Ellipsis } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RowAction = { label: string; icon: React.ReactNode; danger?: boolean; run: (opener: HTMLElement | null) => void };

export function RowMenu({ name, actions }: { name: string; actions: RowAction[] }) {
  const trigger = useRef<HTMLButtonElement>(null);
  if (actions.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} icon variant="secondary" aria-label={`More for ${name}`}>
          <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem key={action.label} className={action.danger ? "text-danger" : ""} onSelect={() => action.run(trigger.current)}>
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
