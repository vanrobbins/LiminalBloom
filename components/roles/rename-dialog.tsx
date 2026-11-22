// Rename a role (spec 0.7, 4.8 part 4): 1 to 40 characters, applied everywhere at once.
// Pinned to the version seen when it opened, so a change made elsewhere is a stale message.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { renameRoleAction } from "@/app/(app)/store/roles/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RoleRow } from "@/lib/access/roles-view";

import { NETWORK_TEXT, refusalText } from "./refusal-text";

type RenameDialogProps = {
  row: RoleRow;
  onClose: (renamed: { from: string; to: string } | null) => void;
  onCloseAutoFocus: (event: Event) => void;
};

export function RenameDialog({ row, onClose, onCloseAutoFocus }: RenameDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(row.name);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      const result = await renameRoleAction(row.id, row.version, name);
      if (result.status === "renamed") return onClose({ from: result.from, to: result.to });
      const { message, stale } = refusalText(result, { role: row.name, name: name.trim() });
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
      title={`Rename ${row.name}`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} autoFocus disabled={isStale} />
        {notice ? (
          <p role="status" className="text-sm text-danger">
            {notice}
          </p>
        ) : null}
        <Button type="submit" loading={isSaving} loadingText="Saving…" disabled={isStale || name.trim() === "" || name.trim() === row.name}>
          Save name
        </Button>
      </form>
    </Dialog>
  );
}
