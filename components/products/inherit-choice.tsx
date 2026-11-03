// "Uses the {category}'s" or "Different for this product" (Week 6.5 spec §3.2,
// §3.4): the radio pair at the top of the product form's space and size
// sections. The section's own fields go in `children`.

"use client";

import { useId } from "react";

type InheritChoiceProps = {
  legend: string;
  categoryName: string;
  /** True for "Different for this product". */
  isOwn: boolean;
  onChange: (isOwn: boolean) => void;
  children: React.ReactNode;
};

const OPTION =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded border border-line px-3 text-ink has-checked:border-ink has-checked:bg-line-subtle has-focus-visible:outline-2 has-focus-visible:outline-ink";

export function InheritChoice({ legend, categoryName, isOwn, onChange, children }: InheritChoiceProps) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line-subtle p-4">
      <legend className="px-1 text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={OPTION}>
          <input type="radio" name={name} checked={!isOwn} onChange={() => onChange(false)} className="size-4 accent-ink" />
          Uses the {categoryName}’s
        </label>
        <label className={OPTION}>
          <input type="radio" name={name} checked={isOwn} onChange={() => onChange(true)} className="size-4 accent-ink" />
          Different for this product
        </label>
      </div>
      {children}
    </fieldset>
  );
}
