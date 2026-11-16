// The editing half of the product panel (spec §4.2; 0.7.0.5 spec §2.4): the
// numbers, which save as they change, and the face picker; or why there is no
// form (removed elsewhere, or its face left the set).

"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlacementView, PlanogramFace } from "@/lib/planograms/types";

import { FacePicker } from "./face-picker";
import { PlacementForm } from "./placement-form";
import type { CommitResult } from "./use-builder";

type PlacementEditorProps = {
  placement: PlacementView | null;
  /** The other device removed it while it was open (spec §4.3). */
  isGone: boolean;
  faces: readonly PlanogramFace[];
  others: readonly Neighbour[];
  busy: boolean;
  onClose: () => void;
  /** Saves the numbers into this placement; says why not when it didn't. */
  onSave: (placement: PlacementView, fields: PlacementFields) => Promise<CommitResult>;
  /** Only for a placement whose face left the set: it has no tile to carry a trash disc. */
  onRemove: (placement: PlacementView) => void;
  /** Resolves to the refusal to show in the panel, or null. */
  onMoveToFace: (placement: PlacementView, faceId: string) => Promise<string | null>;
};

export function PlacementEditor({ placement, isGone, faces, others, busy, onClose, onSave, onRemove, onMoveToFace }: PlacementEditorProps) {
  // Its face left the set (spec §3.3): it can only be removed, never saved there.
  const isOrphan = placement !== null && !faces.some((f) => f.faceId === placement.faceId);
  return isGone ? (
    <div className="flex flex-col items-start gap-3">
      <p className="text-ink">Removed on another device</p>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  ) : placement && isOrphan ? (
    <div className="flex items-center gap-3">
      <p className="flex items-center gap-1 text-danger">
        <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" />
        No longer in this set
      </p>
      <Button icon variant="secondary" aria-label={`Remove ${placement.productName}`} onClick={() => onRemove(placement)} disabled={busy}>
        <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
    </div>
  ) : placement ? (
    <div className="flex flex-col gap-4">
      <PlacementForm
        // One form per placement, so picking another tile sends what is waiting to this one and starts the next from its own numbers.
        // Another device's new version re-fills the fields inside the form (use-placement-editor.ts), not by remounting it under the
        // typing person's fingers.
        key={placement.id}
        faces={faces}
        initial={placement}
        others={others}
        excludeId={placement.id}
        // No stack limit for either presentation (Week 6.5 spec §3.3); hung products share rail space as separate placements (layers.ts).
        onSubmit={(fields) => onSave(placement, fields)}
      />
      <FacePicker key={`face:${placement.id}`} faces={faces} currentFaceId={placement.faceId} onPick={(faceId) => onMoveToFace(placement, faceId)} />
    </div>
  ) : null;
}
