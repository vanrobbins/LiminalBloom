// "Move to face…" (Part 2 spec §4 "Move"): pick a face; the product goes to the
// first open spot there that fits, and stays selected. Dragging between faces
// is out of scope.

"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PlanogramFace } from "@/lib/planograms/types";

type MoveToFaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faces: readonly PlanogramFace[];
  currentFaceId: string;
  onChoose: (faceId: string) => void;
};

export function MoveToFaceDialog({ open, onOpenChange, faces, currentFaceId, onChoose }: MoveToFaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Move to face" description="It goes to the first open spot that fits.">
      <ul className="flex flex-col gap-2">
        {faces
          .filter((f) => f.faceId !== currentFaceId)
          .map((f) => (
            <li key={f.faceId}>
              <Button variant="secondary" className="w-full" onClick={() => onChoose(f.faceId)}>
                {f.label}
              </Button>
            </li>
          ))}
      </ul>
    </Dialog>
  );
}
