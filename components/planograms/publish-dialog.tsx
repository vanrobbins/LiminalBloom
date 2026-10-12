// Publish (spec §5.4). The body mounts each time the dialog opens, so the
// preview is always loaded fresh (co-editing: the other device may have saved).

"use client";

import { useActiveStoreName } from "@/components/shell/shell-context";
import { Dialog } from "@/components/ui/dialog";

import { PublishBody } from "./publish-body";

type PublishDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; fixtureId: string };

export function PublishDialog({ open, onOpenChange, fixtureId }: PublishDialogProps) {
  // Named, because a person sincerely in the wrong store passes every server check (council 10-10).
  const store = useActiveStoreName() ?? "this store";
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Publish to ${store}?`}>
      {open ? <PublishBody fixtureId={fixtureId} store={store} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
