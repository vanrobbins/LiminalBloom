// Add and remove an admin (spec 0.7.1 7.1) on /admin/admins. Add takes the email on the page and asks for the
// reason in the shared dialog; the account must already exist, and the new admin sets up two-step sign-in on
// their first visit to /admin.

"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";

import { addAdminAction, removeAdminAction } from "@/app/admin/admins/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AdminAction } from "./admin-action";
import { ReasonDialog } from "./reason-dialog";

export function AddAdmin() {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const address = email.trim();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (address !== "") setOpen(true);
      }}
    >
      <Input
        label="Email"
        hint="Their account must already exist. They set up two-step sign-in on their first visit."
        type="email"
        value={email}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        className="sm:max-w-sm sm:flex-1"
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" className="self-start">
        <UserPlus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Add admin
      </Button>
      {open ? (
        <ReasonDialog
          title="Add this admin?"
          description={`${address} becomes a Liminal Bloom admin. They can see every store's people, pause stores and add or remove admins.`}
          confirm="Add admin"
          loadingText="Adding…"
          run={(reason) => addAdminAction(address, reason)}
          messages={{ already: `${address} is already an admin.` }}
          onClose={() => {
            setOpen(false);
            setEmail("");
          }}
        />
      ) : null}
    </form>
  );
}

export function RemoveAdmin({ userId, name, isSelf }: { userId: string; name: string; isSelf: boolean }) {
  return (
    <AdminAction
      label="Remove"
      icon={UserMinus}
      buttonVariant="quiet-danger"
      title={isSelf ? "Remove yourself as an admin?" : `Remove ${name} as an admin?`}
      description={isSelf ? "You lose access to the admin area at once. Another admin can add you back." : `${name} loses access to the admin area at once. Another admin can add them back.`}
      confirm="Remove admin"
      loadingText="Removing…"
      variant="danger"
      rowGoes
      messages={{ gone: "They aren't an admin anymore. Close and look again." }}
      run={(reason) => removeAdminAction(userId, reason)}
    />
  );
}
