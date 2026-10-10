// Publish (spec §5.4). The body mounts each time the dialog opens, so the
// preview is always loaded fresh (co-editing: the other device may have saved).

"use client";

import { Dialog } from "@/components/ui/dialog";

import { PublishBody } from "./publish-body";

type PublishDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; fixtureId: string };

export function PublishDialog({ open, onOpenChange, fixtureId }: PublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Publish">
      {open ? <PublishBody fixtureId={fixtureId} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
