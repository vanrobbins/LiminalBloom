// Filters (§3.2 item 3): category, color, status and place, combined with the
// text. A sheet on phones; a bar on wider screens.

"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { useMediaQuery, PHONE_QUERY } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { PRODUCT_STATUS } from "@/lib/product-status";
import { MAX_FILTER_CHOICES, PLACES, PRODUCT_STATUSES, type Place, type SearchInput } from "@/lib/products/schemas";

const PLACE_LABEL: Record<Place, string> = { floor: "On the floor", stockroom: "Stockroom", unplaced: "Not placed" };

type SearchFiltersProps = {
  input: SearchInput;
  categories: { id: string; name: string }[];
  colors: string[];
  onChange: (change: Partial<SearchInput>) => void;
};

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <label className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm has-focus-visible:outline-2 has-focus-visible:outline-ink has-disabled:opacity-60 ${disabled ? "" : "cursor-pointer"} ${checked ? "border-ink bg-ink text-surface" : "border-line bg-raised text-ink"}`}>
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={onChange} />
      {label}
    </label>
  );
}

// A search takes at most MAX_FILTER_CHOICES of each; past that, the rest wait.
const isFull = (chosen: readonly string[]) => chosen.length >= MAX_FILTER_CHOICES;

function Groups({ input, categories, colors, onChange }: SearchFiltersProps) {
  const group = (legend: string, chips: React.ReactNode, limit?: string) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink">{legend}</legend>
      {limit ? <p className="text-sm text-ink-muted">{limit}</p> : null}
      <div className="flex flex-wrap gap-2">{chips}</div>
    </fieldset>
  );
  const limit = (chosen: readonly string[], noun: string) => (isFull(chosen) ? `Up to ${MAX_FILTER_CHOICES} ${noun} at once.` : undefined);
  return (
    <div className="flex flex-col gap-4">
      {group("Status", PRODUCT_STATUSES.map((s) => <Chip key={s} label={PRODUCT_STATUS[s].label} checked={input.statuses.includes(s)} onChange={() => onChange({ statuses: toggle(input.statuses, s) })} />))}
      {group("Where", PLACES.map((p) => <Chip key={p} label={PLACE_LABEL[p]} checked={input.places.includes(p)} onChange={() => onChange({ places: toggle(input.places, p) })} />))}
      {categories.length > 0
        ? group(
            "Category",
            categories.map((c) => {
              const checked = input.categoryIds.includes(c.id);
              return <Chip key={c.id} label={c.name} checked={checked} disabled={!checked && isFull(input.categoryIds)} onChange={() => onChange({ categoryIds: toggle(input.categoryIds, c.id) })} />;
            }),
            limit(input.categoryIds, "categories"),
          )
        : null}
      {colors.length > 0
        ? group(
            "Color",
            colors.map((c) => {
              const checked = input.colors.includes(c);
              return <Chip key={c} label={c} checked={checked} disabled={!checked && isFull(input.colors)} onChange={() => onChange({ colors: toggle(input.colors, c) })} />;
            }),
            limit(input.colors, "colors"),
          )
        : null}
    </div>
  );
}

export function SearchFilters(props: SearchFiltersProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  // Kept locally so unticking the last chip does not close the bar under the pointer.
  const [isBarOpen, setIsBarOpen] = useState(() => props.input.categoryIds.length + props.input.colors.length + props.input.statuses.length + props.input.places.length > 0);
  const { input } = props;
  const count = input.categoryIds.length + input.colors.length + input.statuses.length + input.places.length;

  if (!isPhone) {
    return (
      <details className="mt-3 rounded-lg border border-line-subtle bg-raised p-4" open={isBarOpen} onToggle={(event) => setIsBarOpen(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer content-center font-medium text-ink">Filters{count > 0 ? ` (${count})` : ""}</summary>
        <div className="mt-3">
          <Groups {...props} />
        </div>
      </details>
    );
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-expanded={isOpen}>
        <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} className="size-5" />
        Filters{count > 0 ? ` (${count})` : ""}
      </Button>
      <BottomSheet open={isOpen} onOpenChange={setIsOpen} title="Filters">
        <Groups {...props} />
      </BottomSheet>
    </>
  );
}
