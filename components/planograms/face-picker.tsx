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
  /** Resolves to the refusal to show here, or null once it has moved. */
  onPick: (faceId: string) => Promise<string | null>;
};

export function FacePicker({ faces, currentFaceId, onPick }: FacePickerProps) {
  const [refusal, setRefusal] = useState<string | null>(null);
  if (faces.length < 2) return null;

  async function pick(faceId: string) {
    if (faceId === currentFaceId) return;
    setRefusal(null);
    setRefusal(await onPick(faceId));
  }

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
