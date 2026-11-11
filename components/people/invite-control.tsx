// The Invite button on the People title row and the dialog it opens (spec 0.7, 4.8
// part 1). On a phone a 44 px icon (UserPlus, named "Invite someone"), as Add product
// does; from 768 px a labelled button. Shown only to someone who may invite into at
// least one role: the page decides, and the server checks again.

"use client";

import { UserPlus } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RoleChoice } from "@/lib/access/people-view";

import { InviteDialog } from "./invite-dialog";

export function InviteControl({ roles }: { roles: RoleChoice[] }) {
  const [isOpen, setIsOpen] = useState(false);
  // Radix returns focus to a Trigger, and this dialog opens from state, so the button remembers itself.
  const opener = useRef<HTMLElement | null>(null);

  function open(event: React.MouseEvent<HTMLElement>) {
    opener.current = event.currentTarget;
    setIsOpen(true);
  }

  return (
    <>
      <div className="md:hidden">
        <Button variant="secondary" icon aria-label="Invite someone" onClick={open}>
          <UserPlus aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
      <div className="hidden md:block">
        <Button onClick={open}>Invite</Button>
      </div>
      {isOpen ? (
        <InviteDialog
          roles={roles}
          onClose={() => setIsOpen(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
