// A product's space on the fixture (Week 6.5 spec §3.2): the category's, shown
// in words and drawings, or different for this product, with steppers that
// start from the category's numbers. Going back to the category's keeps what
// was typed until the form saves, so a misclick costs nothing; the save then
// drops the product's own rows. Numbers that match the category store nothing.

"use client";

import { useState } from "react";

import { NumberStepper } from "@/components/ui/number-stepper";
import { feetText } from "@/lib/feet";
import {
  MAX_FOOTPRINT_COLUMNS,
  MAX_FOOTPRINT_ROWS,
  PRESENTATIONS,
  PRESENTATION_LABEL,
  categoryFootprint,
  describeSpace,
  sameAsCategory,
  type CategoryDefaults,
  type Footprint,
  type Overrides,
  type Presentation,
} from "@/lib/products/footprint";

import { InheritChoice } from "./inherit-choice";
import { SpaceDrawing } from "./space-drawing";

type SpaceFieldsProps = {
  categoryName: string;
  category: CategoryDefaults;
  overrides: Overrides;
  onChange: (overrides: Overrides) => void;
};

type Draft = Record<Presentation, Footprint>;

export function SpaceFields({ categoryName, category, overrides, onChange }: SpaceFieldsProps) {
  const [isOwn, setIsOwn] = useState(Object.keys(overrides).length > 0);
  const [draft, setDraft] = useState<Draft>(() => ({
    hung: overrides.hung ?? categoryFootprint(category, "hung"),
    folded: overrides.folded ?? categoryFootprint(category, "folded"),
  }));

  function choose(own: boolean) {
    setIsOwn(own);
    onChange(own ? draft : {});
  }

  function set(presentation: Presentation, footprint: Footprint) {
    const next = { ...draft, [presentation]: footprint };
    setDraft(next);
    onChange(next);
  }

  const shown = (p: Presentation) => (isOwn ? draft[p] : categoryFootprint(category, p));
  const nothingToSave = isOwn && PRESENTATIONS.every((p) => sameAsCategory(category, p, draft[p]));

  return (
    <InheritChoice legend="Space on the fixture" term="space" categoryName={categoryName} isOwn={isOwn} onChange={choose}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PRESENTATIONS.map((p) => {
          const label = PRESENTATION_LABEL[p];
          const f = shown(p);
          return (
            <div key={p} className="flex flex-col gap-2">
              <p className="text-ink">{describeSpace(p, f)}</p>
              <SpaceDrawing footprint={f} />
              {isOwn ? (
                <>
                  <NumberStepper label={`${label} width`} value={f.columns} min={1} max={MAX_FOOTPRINT_COLUMNS} format={(c) => `${feetText(c)} ft`} onChange={(columns) => set(p, { ...f, columns })} />
                  <NumberStepper label={`${label} rows`} value={f.rows} min={1} max={MAX_FOOTPRINT_ROWS} onChange={(rows) => set(p, { ...f, rows })} />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {nothingToSave ? <p className="text-sm text-ink-muted">Same as the category, so nothing to save.</p> : null}
    </InheritChoice>
  );
}
