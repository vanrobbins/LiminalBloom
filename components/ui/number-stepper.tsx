// − value + for small whole numbers such as grid columns: 44 px buttons
// (§5.4), and the value announced as it changes.

"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "./button";

type NumberStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export function NumberStepper({ label, value, min, max, onChange }: NumberStepperProps) {
  const noun = label.toLowerCase();
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" icon aria-label={`Fewer ${noun}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </Button>
        <output aria-live="polite" className="w-8 text-center text-base text-ink tabular-nums">
          {value}
        </output>
        <Button variant="secondary" icon aria-label={`More ${noun}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </Button>
      </div>
    </div>
  );
}
