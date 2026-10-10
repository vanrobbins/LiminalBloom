// Which face is shown (spec §5.2): enabled faces only; nothing for one face.
// The shown face is marked by a check and weight too, not colour alone.

"use client";

import { Check } from "lucide-react";

import type { PlanogramFace } from "@/lib/planograms/types";

type FaceSwitcherProps = { faces: readonly PlanogramFace[]; value: string; onChange: (faceId: string) => void };

export function FaceSwitcher({ faces, value, onChange }: FaceSwitcherProps) {
  if (faces.length <= 1) return null;
  return (
    <div role="group" aria-label="Side" className="flex flex-wrap gap-2">
      {faces.map((face) => (
        <button
          key={face.faceId}
          type="button"
          aria-pressed={face.faceId === value}
          onClick={() => onChange(face.faceId)}
          className="inline-flex min-h-11 items-center gap-1 rounded border border-line bg-raised px-4 text-sm text-ink aria-pressed:border-ink aria-pressed:bg-brand aria-pressed:font-semibold aria-pressed:text-on-brand"
        >
          {face.faceId === value ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
          {face.label}
        </button>
      ))}
    </div>
  );
}
