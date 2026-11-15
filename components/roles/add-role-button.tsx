// Add role on the title row (spec 0.7, 4.8 part 2): a 44 px "+" icon on a phone, a labelled button from
// 768 px, as Invite on People. Off while permissions are staged, with the reason as its title.

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
    <>
      <div className="md:hidden">
        <Button variant="secondary" icon aria-label="Add role" disabled={holdBack !== undefined} title={holdBack} onClick={(event) => onOpen(event.currentTarget)}>
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
      <div className="hidden md:block">
        <Button disabled={holdBack !== undefined} title={holdBack} onClick={(event) => onOpen(event.currentTarget)}>
          Add role
        </Button>
      </div>
    </>
  );
}
