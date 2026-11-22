// Reset a built-in role to what it shipped with (spec 0.7, 4.8 part 4): its name and its
// permissions, not its place in the order. Shows what it will be able to do again.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { resetRoleAction } from "@/app/(app)/store/roles/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { builtinRole, withLockedSwitches } from "@/lib/access/roles";
import type { RoleRow } from "@/lib/access/roles-view";
import { summaryLines } from "@/lib/access/switches";

import { NETWORK_TEXT, refusalText } from "./refusal-text";

type ResetDialogProps = {
  row: RoleRow;
  onClose: (name: string | null) => void;
  onCloseAutoFocus: (event: Event) => void;
};

export function ResetDialog({ row, onClose, onCloseAutoFocus }: ResetDialogProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);
  // The screen only offers Reset on a built-in; the server checks again.
  const base = builtinRole(row.builtin ?? "sales_associate");

  async function reset() {
    setIsSaving(true);
    try {
      const result = await resetRoleAction(row.id, row.version);
      if (result.status === "reset") return onClose(result.name);
      const { message, stale } = refusalText(result, { role: row.name, name: base.name, action: "reset" });
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
      title={`Reset ${row.name}?`}
      description={`Its name goes back to ${base.name} and it can again:`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <ul className="list-disc pl-5 text-sm text-ink-muted">
        {summaryLines(withLockedSwitches(base.switches, base.key)).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">Everyone with this role gets this on their next tap.</p>
      {notice ? (
        <p role="status" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Button onClick={reset} loading={isSaving} loadingText="Resetting…" disabled={isStale}>
        Reset role
      </Button>
    </Dialog>
  );
}
