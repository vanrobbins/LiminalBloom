// The company invitations waiting (spec 0.7.1 6.5), under People. The link is the secret: Copy link puts it on the
// clipboard and nothing is emailed; both Copy link and Cancel are offered only for a row the server sent an id for
// (a role below the viewer's own). The copy icon swaps to a check for a moment; a failed copy is said in words.

"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CopyCheckIcon } from "@/components/people/copy-check-icon";
import { LocalTime } from "@/components/time/local-time";
import { Button } from "@/components/ui/button";
import type { CompanyInvitationRow } from "@/lib/companies/people-read";

import { CancelInvitationDialog } from "./people-dialogs";

export function InvitationsList({ invitations }: { invitations: CompanyInvitationRow[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [cancel, setCancel] = useState<{ invitation: CompanyInvitationRow & { id: string }; opener: HTMLElement | null } | null>(null);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);
  if (invitations.length === 0) return null;

  async function copy(id: string) {
    setProblem(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${id}`);
      setCopied(id);
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      setProblem("Couldn't copy the link. Try again.");
    }
  }

  return (
    <div className="mt-4 border-t border-line-subtle pt-3">
      <h3 className="mb-1 text-sm font-semibold text-ink">Waiting to join</h3>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {invitations.map((row, index) => (
          <li key={row.id ?? `${row.email}-${index}`} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1 text-ink">
              <span className="block wrap-anywhere">{row.email}</span>
              <span className="text-sm text-ink-muted">
                {row.roleName}
                {row.regionName ? ` · ${row.regionName}` : ""}
                {" · until "}
                <LocalTime at={row.expiresAt} />
              </span>
            </span>
            {row.id ? (
              <>
                <Button icon variant="secondary" aria-label={`Copy link for ${row.email}`} onClick={() => copy(row.id as string)}>
                  <CopyCheckIcon copied={copied === row.id} />
                </Button>
                <Button icon variant="secondary" aria-label={`Cancel invitation for ${row.email}`} onClick={(event) => setCancel({ invitation: { ...row, id: row.id as string }, opener: event.currentTarget })}>
                  <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
      {cancel ? <CancelInvitationDialog invitation={cancel.invitation} opener={cancel.opener} onClose={() => setCancel(null)} /> : null}
    </div>
  );
}
