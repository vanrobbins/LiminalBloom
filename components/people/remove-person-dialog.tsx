// Remove someone from the store (spec 0.7, 4.8 part 2). Their account stays; they
// lose access to this store at once, and a new invitation is the way back.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { removePersonAction } from "@/app/(app)/store/people-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PersonRow } from "@/lib/access/people-view";

import { NETWORK_TEXT, refusalText } from "./refusal-text";

type RemovePersonDialogProps = {
  person: PersonRow;
  storeName: string;
  onClose: (removedName: string | null) => void;
  /** The row is gone after a removal, so the screen sends focus to the page title. */
  onCloseAutoFocus: (event: Event) => void;
};

export function RemovePersonDialog({ person, storeName, onClose, onCloseAutoFocus }: RemovePersonDialogProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isStale, setIsStale] = useState(false);

  async function confirm() {
    setIsRemoving(true);
    try {
      const result = await removePersonAction(person.memberId, person.roleId);
      if (result.status === "removed") return onClose(result.name);
      const { message, stale } = refusalText(result.status, person.name);
      setNotice(message);
      setIsStale(stale);
    } catch {
      setNotice(NETWORK_TEXT);
    } finally {
      setIsRemoving(false);
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
      title={`Remove ${person.name}?`}
      description={`They lose access to ${storeName} at once. To bring them back, send a new invitation.`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {notice ? (
        <p role="status" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Button variant="danger" onClick={confirm} loading={isRemoving} loadingText="Removing…" disabled={isStale}>
        Remove from store
      </Button>
    </Dialog>
  );
}
