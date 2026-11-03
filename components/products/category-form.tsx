// A category's name, default space on the fixture and default size range
// (§3.9 item 6, Week 6.5 spec §3.2, §3.4), in a dialog. Always open: the
// category *is* the default its products inherit.

"use client";

import { useState } from "react";

import { saveCategory } from "@/app/(app)/products/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { feetText } from "@/lib/feet";
import { MAX_FOOTPRINT_COLUMNS, MAX_FOOTPRINT_ROWS, PRESENTATIONS, PRESENTATION_LABEL, categoryFootprint, describeSpace, type CategoryDefaults } from "@/lib/products/footprint";
import type { CategoryRow } from "@/lib/products/queries";
import { toast } from "@/lib/toast";

import { SizeRangeInput } from "./size-range-field";
import { SpaceDrawing } from "./space-drawing";

const DEFAULTS: CategoryDefaults = { hungColumns: 2, hungRows: 3, foldedColumns: 4, foldedRows: 2 };
const KEYS = {
  hung: { columns: "hungColumns", rows: "hungRows" },
  folded: { columns: "foldedColumns", rows: "foldedRows" },
} as const;

export function CategoryForm({ category, onDone }: { category?: CategoryRow; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [sizes, setSizes] = useState<CategoryDefaults>(category ?? DEFAULTS);
  const [sizeRange, setSizeRange] = useState(category?.sizeRange ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const set = (key: keyof CategoryDefaults) => (value: number) => setSizes((s) => ({ ...s, [key]: value }));

  async function save() {
    setIsSaving(true);
    const { hungColumns, hungRows, foldedColumns, foldedRows } = sizes;
    try {
      const result = await saveCategory(category?.id ?? null, category?.version ?? null, { name, hungColumns, hungRows, foldedColumns, foldedRows, sizeRange });
      if (result.status === "invalid") {
        setErrors(result.errors);
        return;
      }
      if (result.status === "conflict") toast({ tone: "error", title: "Changed on another device", description: "The current values are loaded." });
      onDone();
    } catch {
      setErrors({ form: "Couldn't save this category. Check your connection and try again." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-ink">Space on the fixture</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PRESENTATIONS.map((p) => {
            const label = PRESENTATION_LABEL[p];
            const f = categoryFootprint(sizes, p);
            return (
              <div key={p} className="flex flex-col gap-2">
                <p className="text-ink">{describeSpace(p, f)}</p>
                <SpaceDrawing footprint={f} />
                <NumberStepper label={`${label} width`} value={f.columns} min={1} max={MAX_FOOTPRINT_COLUMNS} format={(c) => `${feetText(c)} ft`} onChange={set(KEYS[p].columns)} />
                <NumberStepper label={`${label} rows`} value={f.rows} min={1} max={MAX_FOOTPRINT_ROWS} onChange={set(KEYS[p].rows)} />
              </div>
            );
          })}
        </div>
      </fieldset>
      <SizeRangeInput value={sizeRange} onChange={setSizeRange} error={errors.sizeRange} />
      {errors.form ? (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      ) : null}
      <Button onClick={save} loading={isSaving} loadingText="Saving…">
        {category ? "Save category" : "Add category"}
      </Button>
    </div>
  );
}
