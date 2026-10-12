// Which face is shown (spec §5.2): enabled faces only; nothing for one face.
// The shown face is marked by a check and weight too, not colour alone.

"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlanogramFace } from "@/lib/planograms/types";

type FaceSwitcherProps = { faces: readonly PlanogramFace[]; value: string; onChange: (faceId: string) => void };

export function FaceSwitcher({ faces, value, onChange }: FaceSwitcherProps) {
  if (faces.length <= 1) return null;
  return <SegmentedControl label="Side" options={faces.map((f) => ({ value: f.faceId, label: f.label }))} value={value} onChange={onChange} />;
}
