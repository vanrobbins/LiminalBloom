// Discard the staged permission changes (0.7.0.5 spec 3.4): a confirm first, because one tap
// would throw away a whole batch. Nothing is saved yet, so there is no server call and no failure.

"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type DiscardDialogProps = {
  count: number;
  /** True when the changes are to be thrown away; false for Cancel, Escape or the close button. */
  onClose: (discarded: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
};

export function DiscardDialog({ count, onClose, onCloseAutoFocus }: DiscardDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose(false);
      }}
      title="Discard your changes?"
      description={`${count === 1 ? "1 role goes" : `${count} roles go`} back to what is saved. This can't be undone.`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={() => onClose(true)}>
          Discard changes
        </Button>
        <Button variant="secondary" onClick={() => onClose(false)}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
