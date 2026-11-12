// The pending invitations, for someone who may manage people (spec 0.7, 4.8 part
// 1). The link is the secret (4.9): Copy link puts it on the clipboard, and nothing
// is emailed. Cancel acts at once, like the other one-step actions; a row the rank
// rule doesn't reach is read-only.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelInvitationAction } from "@/app/(app)/people/actions";
import { LocalTime } from "@/components/time/local-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import type { InvitationRow } from "@/lib/access/people-view";
import { toast } from "@/lib/toast";

import { refusalText } from "./refusal-text";

export function InvitationsCard({ invitations }: { invitations: InvitationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${id}`);
      toast({ tone: "success", title: "Link copied" });
    } catch {
      toast({ tone: "error", title: "Couldn't copy the link", description: "Try again." });
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      const result = await cancelInvitationAction(id);
      if (result.status === "cancelled") toast({ tone: "success", title: `Cancelled the invitation for ${result.email}` });
      else if (result.status === "gone") toast({ tone: "error", title: "This invitation was already used or cancelled." });
      else toast({ tone: "error", title: refusalText("forbidden", "").message });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't cancel", description: "Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card compact className="mb-6">
      <h2 className="inline-flex items-center gap-1 text-lg font-semibold text-ink">
        Invitations waiting
        <InfoPopover term="invitation" />
      </h2>
      <ul className="mt-2 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
        {invitations.map((i, n) => {
          // A row with no id is read-only (the server withholds the id, which is the link), so its key is its place in the list.
          const id = i.id;
          return (
            <li key={id ?? `read-only-${n}`} className="flex flex-wrap items-center gap-3 bg-raised px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink wrap-break-word">{i.email}</span>
                <span className="text-sm text-ink-muted">
                  {i.linkWorks ? `${i.roleName} role` : i.roleName} · {i.lapsed && !i.expired ? "Lapsed" : <>{i.expired ? "Expired" : "Expires"} <LocalTime at={i.expiresAt} /></>}
                </span>
              </span>
              {id !== null && i.linkWorks && !i.expired && !i.lapsed ? (
                <Button variant="secondary" onClick={() => copy(id)} aria-label={`Copy link for ${i.email}`}>
                  Copy link
                </Button>
              ) : null}
              {id !== null ? (
                <Button variant="quiet-danger" onClick={() => cancel(id)} loading={busy === id} loadingText="Cancelling…" aria-label={`Cancel invitation for ${i.email}`}>
                  Cancel
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
