// One choice of a few, side by side (Draft | Published, Front | Back). The
// current one is marked by a check and weight as well as gold: never colour alone.

"use client";

import { Check } from "lucide-react";

type SegmentedControlProps<T extends string> = { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void };

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-4 text-sm whitespace-nowrap text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-brand aria-pressed:font-semibold aria-pressed:text-on-brand motion-safe:transition-colors motion-safe:duration-(--duration-fast)"
        >
          {o.value === value ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}
