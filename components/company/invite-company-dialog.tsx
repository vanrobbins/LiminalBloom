// Invite someone into a company role (spec 0.7.1 6.5). The form makes the invitation; the same dialog then shows its
// link to copy and hand over, as the store invite does (nothing is emailed: the link is the invitation). Roles are
// only those below the viewer's own, given by the server; a regional manager needs a region. The server checks the
// rank rule again, and refuses in words inside the dialog.

"use client";

import { Label } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { inviteCompanyPersonAction } from "@/app/(app)/company/people-actions";
import { CopyCheckIcon } from "@/components/people/copy-check-icon";
import { LocalTime } from "@/components/time/local-time";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { INVITATION_HOURS } from "@/lib/access/invite-limits";
import { CONNECTION_ERROR } from "@/lib/connection-error";

export type RoleChoice = { key: "corporate_admin" | "regional_manager"; name: string };
export type RegionChoice = { id: string; name: string };

type Made = { email: string; link: string; expiresAt: string };

export function InviteCompanyDialog({ roles, regions, initialRole, opener, onClose }: { roles: RoleChoice[]; regions: RegionChoice[]; initialRole?: RoleChoice["key"]; opener: HTMLElement | null; onClose: () => void }) {
  const router = useRouter();
  const roleSelect = useId();
  const regionSelect = useId();
  const linkField = useRef<HTMLInputElement>(null);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [email, setEmail] = useState("");
  // The lowest role first: the safest to start from.
  const [role, setRole] = useState<RoleChoice["key"]>(initialRole && roles.some((r) => r.key === initialRole) ? initialRole : (roles[roles.length - 1]?.key ?? "regional_manager"));
  const [region, setRegion] = useState(regions[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => () => clearTimeout(reset.current), []);
  const needsRegion = role === "regional_manager";

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const reply = await inviteCompanyPersonAction(email, role, needsRegion ? region : null);
      if (reply.status === "created") {
        setMade({ email: reply.email, link: `${window.location.origin}/invite/${reply.id}`, expiresAt: reply.expiresAt });
        router.refresh();
      } else setNotice(reply.message);
    } catch {
      setNotice(CONNECTION_ERROR);
    } finally {
      setSaving(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyNotice("Copied");
      setCopied(true);
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      linkField.current?.select();
      setCopyNotice("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Invite someone to the company"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        opener?.focus();
      }}
    >
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
            <Label.Root htmlFor={roleSelect} className="text-sm text-ink">
              Role
            </Label.Root>
            <select id={roleSelect} value={role} onChange={(event) => setRole(event.target.value as RoleChoice["key"])} className={FIELD_CLASSES}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-ink-muted">You can invite into roles below yours.</p>
          </div>
          {needsRegion ? (
            <div className="flex flex-col gap-1">
              <Label.Root htmlFor={regionSelect} className="text-sm text-ink">
                Region
              </Label.Root>
              {regions.length === 0 ? (
                <p className="text-sm text-ink-muted">Add a region first. A regional manager looks after one.</p>
              ) : (
                <select id={regionSelect} value={region} onChange={(event) => setRegion(event.target.value)} className={FIELD_CLASSES}>
                  {regions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          {notice ? (
            <p role="alert" className="text-sm text-danger">
              {notice}
            </p>
          ) : null}
          <Button type="submit" loading={saving} loadingText="Creating…" disabled={needsRegion && regions.length === 0}>
            Create invite link
          </Button>
        </form>
      )}
    </Dialog>
  );
}
