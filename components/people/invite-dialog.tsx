// Invite someone (spec 0.7, 4.8 part 5). The form makes an invitation; the same
// dialog then shows its link to copy and hand over. Nothing is emailed (4.9): the
// link is the invitation, so it is shown once, here, and again by Copy link on the
// invitations card for as long as it works. The roles listed are the ones the viewer
// outranks; the server checks the rank rule again.

"use client";

import { Label } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createInvitationAction } from "@/app/(app)/store/people-actions";
import { LocalTime } from "@/components/time/local-time";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InfoPopover } from "@/components/ui/info-popover";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { INVITATION_HOURS } from "@/lib/access/invite-limits";
import type { RoleChoice } from "@/lib/access/people-view";

import { CopyCheckIcon } from "./copy-check-icon";
import { inviteRefusalText } from "./invite-refusal";
import { NETWORK_TEXT } from "./refusal-text";

const COPIED_MS = 1500;

type Made = { email: string; link: string; expiresAt: string };

type InviteDialogProps = {
  roles: RoleChoice[];
  onClose: () => void;
  /** Where focus goes when the dialog closes: the Invite button it came from. */
  onCloseAutoFocus: (event: Event) => void;
};

/** The lowest rank is the largest number: the safest role to start from. */
const lowest = (roles: RoleChoice[]) => roles.reduce((a, b) => (b.rank > a.rank ? b : a), roles[0]);

export function InviteDialog({ roles, onClose, onCloseAutoFocus }: InviteDialogProps) {
  const router = useRouter();
  const roleSelect = useId();
  const linkField = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(lowest(roles)?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      const result = await createInvitationAction(email, roleId);
      if (result.status === "created") {
        setMade({ email: result.email, link: `${window.location.origin}/invite/${result.id}`, expiresAt: result.expiresAt });
        // The new invitation joins the card behind this dialog.
        router.refresh();
      } else {
        setNotice(inviteRefusalText(result));
      }
    } catch {
      setNotice(NETWORK_TEXT);
    } finally {
      setIsSaving(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyNotice("Copied");
      setCopied(true);
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // No clipboard (or it was refused): leave the link selected for a hand copy.
      linkField.current?.select();
      setCopyNotice("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onClose())} title="Invite someone" onCloseAutoFocus={onCloseAutoFocus}>
      {made ? (
        <>
          <p className="text-ink">
            Send this link to {made.email}. It works until <LocalTime at={made.expiresAt} /> ({INVITATION_HOURS} hours).
          </p>
          <Input ref={linkField} label="Invite link" readOnly value={made.link} onFocus={(event) => event.currentTarget.select()} />
          <div className="flex flex-wrap items-center gap-3">
            <Button icon variant="secondary" onClick={() => copy(made.link)} aria-label="Copy link">
              <CopyCheckIcon copied={copied} />
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
          {copyNotice ? (
            <p role="status" className="text-sm text-ink-muted">
              {copyNotice}
            </p>
          ) : null}
        </>
      ) : (
        <form onSubmit={create} noValidate className="flex flex-col gap-4">
          <Input label="Email" name="email" type="email" required autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Label.Root htmlFor={roleSelect} className="text-sm text-ink">
                Role
              </Label.Root>
              <InfoPopover term="role" />
            </div>
            <select id={roleSelect} value={roleId} onChange={(event) => setRoleId(event.target.value)} className={FIELD_CLASSES}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-ink-muted">You can invite into roles below yours.</p>
          </div>
          {notice ? (
            <p role="status" className="text-sm text-danger">
              {notice}
            </p>
          ) : null}
          <Button type="submit" loading={isSaving} loadingText="Creating…">
            Create invite link
          </Button>
        </form>
      )}
    </Dialog>
  );
}
