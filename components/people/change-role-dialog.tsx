// Change one person's role (spec 0.7, 4.8 part 2). The list holds only roles
// ranked below the viewer's; the server checks the rank rule again. The save is
// pinned to the role the person held when this opened, so a change made elsewhere
// shows as a stale message instead of being overwritten.

"use client";

import { Label } from "radix-ui";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { changeRoleAction } from "@/app/(app)/people/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InfoPopover } from "@/components/ui/info-popover";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import type { PersonRow, RoleChoice } from "@/lib/access/people-view";

import { NETWORK_TEXT, refusalText } from "./refusal-text";

type ChangeRoleDialogProps = {
  person: PersonRow;
  roles: RoleChoice[];
  onClose: (changed: { name: string; roleName: string } | null) => void;
  /** Where focus goes when the dialog closes: the screen puts it back on this row's button after a change. */
  onCloseAutoFocus: (event: Event) => void;
};

export function ChangeRoleDialog({ person, roles, onClose, onCloseAutoFocus }: ChangeRoleDialogProps) {
  const router = useRouter();
  const selectId = useId();
  // A person with no role has nothing selected until a role is picked.
  const [roleId, setRoleId] = useState(person.roleId ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      const result = await changeRoleAction(person.memberId, person.roleId, roleId);
      if (result.status === "changed") return onClose({ name: result.name, roleName: result.roleName });
      const { message, stale } = refusalText(result.status, person.name);
      setNotice(message);
      setIsStale(stale);
    } catch {
      setNotice(NETWORK_TEXT);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        if (isStale) router.refresh();
        onClose(null);
      }}
      title={`Change ${person.name}'s role`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Label.Root htmlFor={selectId} className="text-sm text-ink">
            Role
          </Label.Root>
          <InfoPopover term="role" />
        </div>
        <select id={selectId} value={roleId} onChange={(event) => setRoleId(event.target.value)} className={FIELD_CLASSES} disabled={isStale}>
          {person.roleId === null ? (
            <option value="" disabled>
              No role
            </option>
          ) : null}
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {notice ? (
        <p role="status" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Button onClick={save} loading={isSaving} loadingText="Saving…" disabled={isStale || roleId === "" || roleId === person.roleId}>
        Save role
      </Button>
    </Dialog>
  );
}
