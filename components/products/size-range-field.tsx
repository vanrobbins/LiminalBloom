// A size range with quick picks (Week 6.5 spec §3.4). A chip fills the input,
// en dash included; the input stays editable. The category form uses it
// alone; the product form wraps it in "Uses the {category}'s / Different".

"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import type { Term } from "@/lib/glossary";
import { SIZE_PICKS } from "@/lib/products/footprint";

import { InheritChoice } from "./inherit-choice";

type SizeRangeInputProps = { value: string; onChange: (value: string) => void; error?: string; info?: Term };

export function SizeRangeInput({ value, onChange, error, info }: SizeRangeInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Input label="Size range" info={info} value={value} onChange={(event) => onChange(event.target.value)} hint="For example XS–XL or 24–34." error={error} />
      <div role="group" aria-label="Quick picks" className="flex flex-wrap gap-2">
        {SIZE_PICKS.map((pick) => (
          <button
            key={pick}
            type="button"
            aria-pressed={value === pick}
            onClick={() => onChange(pick)}
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-raised px-4 text-sm text-ink focus-visible:outline-2 focus-visible:outline-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-surface"
          >
            {pick}
          </button>
        ))}
      </div>
    </div>
  );
}

type SizeRangeFieldProps = {
  categoryName: string;
  categoryRange: string;
  /** The product's own range, or null to use the category's. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
};

export function SizeRangeField({ categoryName, categoryRange, value, onChange, error }: SizeRangeFieldProps) {
  // What was typed survives a switch to the category's and back, until save.
  const [draft, setDraft] = useState(value ?? categoryRange);
  const isOwn = value !== null;
  return (
    <InheritChoice legend="Size range" term="sizeRange" categoryName={categoryName} isOwn={isOwn} onChange={(own) => onChange(own ? draft : null)}>
      {isOwn ? (
        <SizeRangeInput
          value={draft}
          error={error}
          onChange={(next) => {
            setDraft(next);
            onChange(next);
          }}
        />
      ) : (
        <p className="text-ink">{categoryRange || "None set"}</p>
      )}
    </InheritChoice>
  );
}
