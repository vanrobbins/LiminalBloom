// The editing half of the product sheet (spec §4.2): the form, or why there is
// no form (removed elsewhere, or its face left the set).

"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlacementView, PlanogramFace } from "@/lib/planograms/types";

import { PlacementForm } from "./placement-form";

type PlacementEditorProps = {
  placement: PlacementView | null;
  /** The other device removed it while it was open (spec §4.3). */
  isGone: boolean;
  faces: readonly PlanogramFace[];
  others: readonly Neighbour[];
  busy: boolean;
  onClose: () => void;
  /** Resolves to the server's refusal, or null. */
  onSave: (placement: PlacementView, fields: PlacementFields) => Promise<string | null>;
  onRemove: (placement: PlacementView) => void;
};

export function PlacementEditor({ placement, isGone, faces, others, busy, onClose, onSave, onRemove }: PlacementEditorProps) {
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
    <div className="flex flex-col items-start gap-3">
      <p className="flex items-center gap-1 text-danger">
        <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" />
        No longer in this set
      </p>
      <Button variant="secondary" onClick={() => onRemove(placement)} disabled={busy}>
        Remove
      </Button>
    </div>
  ) : placement ? (
    <PlacementForm
      // A new version from the other device re-fills the fields.
      key={`${placement.id}:${placement.version}`}
      faces={faces}
      initial={placement}
      others={others}
      excludeId={placement.id}
      // The folded limit; hung product doesn't stack (rules.ts ignores it).
      stackLimitFor={() => placement.stackLimit}
      submitLabel="Save"
      busy={busy}
      onSubmit={(fields) => onSave(placement, fields)}
      onRemove={() => onRemove(placement)}
    />
  ) : null;
}
