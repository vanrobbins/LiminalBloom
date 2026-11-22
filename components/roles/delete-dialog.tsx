// Delete a custom role (spec 0.7, 4.8 part 4; built-ins are never offered it). Nobody holds it:
// a plain confirm. People hold it: they and the pending invitations move to another role in the same
// step, so the dialog names them, asks where, and is pinned to the count it showed. Moving people needs
// `people.manage` as well, which the dialog says when the viewer lacks it. If the people changed
// meanwhile the list refreshes in place and nothing is moved.

"use client";

import { Label } from "radix-ui";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteRoleAction } from "@/app/(app)/store/roles/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import type { RolePeople, RoleRow } from "@/lib/access/roles-view";

import { NETWORK_TEXT, refusalText } from "./refusal-text";

type DeleteDialogProps = {
  row: RoleRow;
  /** The roles the viewer may move people into (those below their own), in rank order. */
  destinations: RoleRow[];
  canMovePeople: boolean;
  /** The toast text once it is done, or null when closed without deleting. */
  onClose: (done: string | null) => void;
  onCloseAutoFocus: (event: Event) => void;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteDialog({ row, destinations, canMovePeople, onClose, onCloseAutoFocus }: DeleteDialogProps) {
  const router = useRouter();
  const selectId = useId();
  const options = destinations.filter((d) => d.id !== row.id);
  const [people, setPeople] = useState<RolePeople>(row.people);
  // The role just below this one, else the one just above.
  const [moveTo, setMoveTo] = useState((options.find((o) => o.rank > row.rank) ?? options[options.length - 1])?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const members = people.names.length;
  const holds = members + people.invitations > 0;

  async function confirm() {
    setIsSaving(true);
    try {
      const result = await deleteRoleAction(row.id, row.version, holds ? moveTo : null, members, people.invitations);
      if (result.status === "deleted") {
        const moved = [members > 0 ? plural(members, "person", "people") : "", people.invitations > 0 ? plural(people.invitations, "waiting invitation", "waiting invitations") : ""].filter(Boolean).join(" and ");
        return onClose(holds ? `Moved ${moved} to ${options.find((o) => o.id === moveTo)?.name} and deleted ${row.name}` : `Deleted ${row.name}`);
      }
      if (result.status === "people-changed") setPeople({ names: result.names, invitations: result.invitations });
      const { message, stale } = refusalText(result, { role: row.name, action: "delete" });
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
      title={`Delete ${row.name}?`}
      description={holds ? `${plural(members, "person has", "people have")} this role. Move them to another role first; it happens in the same step.` : "This can't be undone."}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {holds ? (
        <>
          {members > 0 ? (
            <ul className="list-disc pl-5 text-ink">
              {people.names.map((name, i) => (
                <li key={`${name}-${i}`}>{name}</li>
              ))}
            </ul>
          ) : null}
          {people.invitations > 0 ? <p className="text-sm text-ink-muted">{plural(people.invitations, "waiting invitation moves", "waiting invitations move")} too.</p> : null}
          {canMovePeople ? (
            <div className="flex flex-col gap-1">
              <Label.Root htmlFor={selectId} className="text-sm text-ink">
                Move them to
              </Label.Root>
              <select id={selectId} value={moveTo} onChange={(event) => setMoveTo(event.target.value)} className={FIELD_CLASSES} disabled={isStale}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p role="status" className="text-sm text-danger">
              {refusalText({ status: "cant-move-people" }, { role: row.name }).message}
            </p>
          )}
        </>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Button variant="danger" onClick={confirm} loading={isSaving} loadingText="Deleting…" disabled={isStale || (holds && (!canMovePeople || moveTo === ""))}>
        {holds ? `Move ${plural(members + people.invitations, "person", "people")} and delete` : "Delete role"}
      </Button>
    </Dialog>
  );
}
