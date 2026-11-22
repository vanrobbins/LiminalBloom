// The summary before saving (spec 0.7, 4.8 part 3; outline 3.10 item 5): per changed role, what it
// can now do, what it no longer can, and everything it can after. One save writes every staged
// role together or none. A stale refusal turns Save off; closing then reloads and drops the edits.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { saveSwitchesAction } from "@/app/(app)/store/roles/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { changeSummary, type RoleRow } from "@/lib/access/roles-view";

import { NETWORK_TEXT, refusalText } from "./refusal-text";
import { switchesOf, type Staged } from "./staged";

type ReviewDialogProps = {
  rows: RoleRow[];
  staged: Staged;
  /** `saved` is the number of roles written, or null when closed without saving; `stale` says the screen was reloaded because a role changed meanwhile, so the staged edits are no longer worth keeping. */
  onClose: (saved: number | null, stale?: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
};

export function ReviewDialog({ rows, staged, onClose, onCloseAutoFocus }: ReviewDialogProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const changed = rows.filter((r) => staged[r.id] !== undefined);

  async function save() {
    setIsSaving(true);
    try {
      const result = await saveSwitchesAction(changed.map((r) => ({ roleId: r.id, version: r.version, switches: switchesOf(r, staged) })));
      if (result.status === "saved") return onClose(result.roles);
      const { message, stale } = refusalText(result, { role: "A role" });
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
        onClose(null, isStale);
      }}
      title={`Save changes to ${changed.length === 1 ? "1 role" : `${changed.length} roles`}?`}
      description="Everyone with these roles gets the change on their next tap. Nobody is signed out."
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {changed.map((r) => {
        const { added, removed, now } = changeSummary(r.switches, switchesOf(r, staged));
        return (
          <section key={r.id} className="flex flex-col gap-1">
            <h3 className="font-semibold text-ink">{r.name}</h3>
            {added.length > 0 ? <Lines heading="Now can:" lines={added} /> : null}
            {removed.length > 0 ? <Lines heading="No longer can:" lines={removed} /> : null}
            <Lines heading={`After saving, ${r.name} can:`} lines={now} muted />
          </section>
        );
      })}
      {notice ? (
        <p role="status" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Button onClick={save} loading={isSaving} loadingText="Saving…" disabled={isStale}>
        Save changes
      </Button>
    </Dialog>
  );
}

function Lines({ heading, lines, muted = false }: { heading: string; lines: string[]; muted?: boolean }) {
  return (
    <>
      <p className={`text-sm font-medium ${muted ? "mt-1 text-ink-muted" : "text-ink"}`}>{heading}</p>
      <ul className="list-disc pl-5 text-sm text-ink-muted">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}
