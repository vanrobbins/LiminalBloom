// The pending invitations, for someone who may manage people (spec 0.7, 4.8 part
// 1). The link is the secret (4.9): Copy link puts it on the clipboard, and nothing
// is emailed. Cancel acts at once, like the other one-step actions; a row the rank
// rule doesn't reach is read-only. No toasts (0.7.0.5 spec §3.1): Copy's icon swaps to
// a check for 1.5 s, a cancelled row folds shut, and a refusal shows on its row, all
// said again in one polite live region. A lost connection stays a toast.

"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cancelInvitationAction } from "@/app/(app)/people/actions";
import { LocalTime } from "@/components/time/local-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CollapseItem } from "@/components/ui/collapse-item";
import { InfoPopover } from "@/components/ui/info-popover";
import { useCollapseOut } from "@/components/ui/use-collapse-out";
import type { InvitationRow } from "@/lib/access/people-view";
import { toast } from "@/lib/toast";

import { refusalText } from "./refusal-text";

const COPIED_MS = 1500;
const FADE = "motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-[var(--ease-enter)]";

export function InvitationsCard({ invitations }: { invitations: InvitationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // What went wrong, and on which row (a row with no id never has one).
  const [problem, setProblem] = useState<{ id: string; text: string } | null>(null);
  const { isLeaving, collapse } = useCollapseOut();
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  async function copy(id: string) {
    setProblem(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${id}`);
      setCopied(id);
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setCopied(null), COPIED_MS);
    } catch {
      setProblem({ id, text: "Couldn't copy the link. Try again." });
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    setProblem(null);
    try {
      const result = await cancelInvitationAction(id);
      // Cancelled, or already used or cancelled: either way it is gone, so the row folds shut and then the list reloads.
      if (result.status === "cancelled" || result.status === "gone") return collapse(id, () => router.refresh());
      setProblem({ id, text: refusalText("forbidden", "").message });
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
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied" : (problem?.text ?? "")}
      </p>
      <ul className="mt-2 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
        {invitations.map((i, n) => {
          // A row with no id is read-only (the server withholds the id, which is the link), so its key is its place in the list.
          const id = i.id;
          return (
            <CollapseItem key={id ?? `read-only-${n}`} leaving={id !== null && isLeaving(id)} className="flex flex-wrap items-center gap-3 bg-raised px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink wrap-break-word">{i.email}</span>
                <span className="text-sm text-ink-muted">
                  {i.linkWorks ? `${i.roleName} role` : i.roleName} · {i.lapsed && !i.expired ? "Lapsed" : <>{i.expired ? "Expired" : "Expires"} <LocalTime at={i.expiresAt} /></>}
                </span>
              </span>
              {id !== null && i.linkWorks && !i.expired && !i.lapsed ? (
                <Button variant="secondary" icon onClick={() => copy(id)} aria-label={`Copy link for ${i.email}`}>
                  {/* The copy icon swaps to a check: one slot, two icons trading opacity. */}
                  <span className="relative size-5">
                    <Copy aria-hidden="true" strokeWidth={1.75} className={`absolute inset-0 size-5 ${FADE} ${copied === id ? "opacity-0" : "opacity-100"}`} />
                    <Check data-copied aria-hidden="true" strokeWidth={2} className={`absolute inset-0 size-5 ${FADE} ${copied === id ? "opacity-100" : "opacity-0"}`} />
                  </span>
                </Button>
              ) : null}
              {id !== null ? (
                <Button variant="quiet-danger" onClick={() => cancel(id)} loading={busy === id} loadingText="Cancelling…" aria-label={`Cancel invitation for ${i.email}`}>
                  Cancel
                </Button>
              ) : null}
              {id !== null && problem?.id === id ? (
                <p aria-hidden="true" className="w-full text-sm text-danger">
                  {problem.text}
                </p>
              ) : null}
            </CollapseItem>
          );
        })}
      </ul>
    </Card>
  );
}
