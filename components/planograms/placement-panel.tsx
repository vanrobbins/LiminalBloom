// Editing one placement (spec §5.3): a bottom sheet on phones, a panel beside
// the grid on larger screens, like the location sheet.

"use client";

import { AlertTriangle, X } from "lucide-react";

import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlacementView, PlanogramFace } from "@/lib/planograms/types";

import { PlacementForm } from "./placement-form";

type PlacementPanelProps = {
  open: boolean;
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

export function PlacementPanel({ open, placement, isGone, faces, others, busy, onClose, onSave, onRemove }: PlacementPanelProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const title = placement?.productName ?? "Placement";
  // Its face left the set (spec §3.3): it can only be removed, never saved there.
  const isOrphan = placement !== null && !faces.some((f) => f.faceId === placement.faceId);
  const body = isGone ? (
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

  if (isPhone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => (next ? null : onClose())} title={title}>
        {body}
      </BottomSheet>
    );
  }
  if (!open) return null;
  return (
    <aside aria-label={title} className="flex flex-col gap-4 rounded-lg border border-line-subtle bg-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-ink wrap-anywhere">{title}</h2>
        <Button variant="ghost" icon onClick={onClose} aria-label="Close">
          <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
      {body}
    </aside>
  );
}
