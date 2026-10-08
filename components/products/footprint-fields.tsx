// The product's footprints (spec §5.1): the category's default for hung and
// folded, and an override only where this product differs (§10 risk table).

"use client";

import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  MAX_CELLS,
  MAX_STACK,
  PRESENTATIONS,
  PRESENTATION_LABEL,
  categoryFootprint,
  describeFootprint,
  type CategoryDefaults,
  type Footprint,
  type Overrides,
} from "@/lib/products/footprint";

type FootprintFieldsProps = {
  category: CategoryDefaults;
  overrides: Overrides;
  onChange: (overrides: Overrides) => void;
};

export function FootprintFields({ category, overrides, onChange }: FootprintFieldsProps) {
  const set = (presentation: (typeof PRESENTATIONS)[number], footprint: Footprint | undefined) => {
    const next = { ...overrides };
    if (footprint) next[presentation] = footprint;
    else delete next[presentation];
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-line-subtle p-4">
      <legend className="px-1 text-sm font-medium text-ink">Footprint</legend>
      {PRESENTATIONS.map((presentation) => {
        const label = PRESENTATION_LABEL[presentation];
        const lower = label.toLowerCase();
        const override = overrides[presentation];
        const defaults = categoryFootprint(category, presentation);
        if (!override) {
          return (
            <div key={presentation} className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-muted">
                {label}: {describeFootprint(defaults)}, stack {defaults.stackLimit} (category default)
              </p>
              <Button variant="secondary" onClick={() => set(presentation, defaults)} aria-label={`Override ${lower} for this product`}>
                Override
              </Button>
            </div>
          );
        }
        return (
          <div key={presentation} className="flex flex-col gap-2">
            <p className="font-medium text-ink">{label} (this product only)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <NumberStepper label={`${label} columns`} value={override.columns} min={1} max={MAX_CELLS} onChange={(columns) => set(presentation, { ...override, columns })} />
              <NumberStepper label={`${label} rows`} value={override.rows} min={1} max={MAX_CELLS} onChange={(rows) => set(presentation, { ...override, rows })} />
              <NumberStepper label={`${label} stack limit`} value={override.stackLimit} min={1} max={MAX_STACK} onChange={(stackLimit) => set(presentation, { ...override, stackLimit })} />
            </div>
            <Button variant="ghost" onClick={() => set(presentation, undefined)} aria-label={`Use category default for ${lower}`}>
              Use category default
            </Button>
          </div>
        );
      })}
    </fieldset>
  );
}
