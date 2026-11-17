// Add role on the title row (spec 0.7, 4.8 part 2): a 44 px "+" icon at every size (0.7.0.5), as Invite
// on People. Off while permissions are staged, with the reason as its title.

"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type AddRoleButtonProps = {
  /** Why the button is off, or undefined when it isn't. */
  holdBack: string | undefined;
  onOpen: (trigger: HTMLElement) => void;
};

export function AddRoleButton({ holdBack, onOpen }: AddRoleButtonProps) {
  return (
    <Button icon aria-label="Add role" disabled={holdBack !== undefined} title={holdBack} onClick={(event) => onOpen(event.currentTarget)}>
      <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
    </Button>
  );
}
