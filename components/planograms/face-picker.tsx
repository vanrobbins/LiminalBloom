// "Move to face" as one choice among the faces, in the product panel (0.7.0.5
// spec §2.4; it replaces the Move to face dialog). Picking another face moves
// the tile to the first open spot there that fits and keeps it selected; if
// nothing fits the reason shows here, beside the choice. Nothing for one face.

"use client";

import { useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlanogramFace } from "@/lib/planograms/types";

type FacePickerProps = {
  faces: readonly PlanogramFace[];
  currentFaceId: string;
  /** Where the placement sits (face and cells): a refusal is about that spot, so it goes when this changes. */
  spot: string;
  /** Resolves to the refusal to show here, or null once it has moved. */
  onPick: (faceId: string) => Promise<string | null>;
};

export function FacePicker({ faces, currentFaceId, spot, onPick }: FacePickerProps) {
  const [refused, setRefused] = useState<{ text: string; spot: string } | null>(null);
  if (faces.length < 2) return null;

  async function pick(faceId: string) {
    if (faceId === currentFaceId) return;
    setRefused(null);
    const text = await onPick(faceId);
    // Kept with the spot it was refused at: one that has moved since (another device, an Undo) is not hidden behind it.
    setRefused(text ? { text, spot } : null);
  }
  const refusal = refused?.spot === spot ? refused.text : null;

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl label="Face" options={faces.map((f) => ({ value: f.faceId, label: f.label }))} value={currentFaceId} onChange={(id) => void pick(id)} />
      {refusal ? (
        <p role="alert" className="text-sm text-danger">
          {refusal}
        </p>
      ) : null}
    </div>
  );
}
