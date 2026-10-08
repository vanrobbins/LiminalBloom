// A category's name and default footprints (§3.9 item 6), in a dialog.

"use client";

import { useState } from "react";

import { saveCategory } from "@/app/(app)/products/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { MAX_CELLS, MAX_STACK, type CategoryDefaults } from "@/lib/products/footprint";
import type { CategoryRow } from "@/lib/products/queries";
import { toast } from "@/lib/toast";

const DEFAULTS: CategoryDefaults = { hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8 };

export function CategoryForm({ category, onDone }: { category?: CategoryRow; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [sizes, setSizes] = useState<CategoryDefaults>(category ?? DEFAULTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const set = (key: keyof CategoryDefaults) => (value: number) => setSizes((s) => ({ ...s, [key]: value }));

  async function save() {
    setIsSaving(true);
    const { hungColumns, hungRows, foldedColumns, foldedRows, stackLimit } = sizes;
    try {
      const result = await saveCategory(category?.id ?? null, category?.version ?? null, { name, hungColumns, hungRows, foldedColumns, foldedRows, stackLimit });
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
      <div className="grid grid-cols-2 gap-3">
        <NumberStepper label="Hung columns" value={sizes.hungColumns} min={1} max={MAX_CELLS} onChange={set("hungColumns")} />
        <NumberStepper label="Hung rows" value={sizes.hungRows} min={1} max={MAX_CELLS} onChange={set("hungRows")} />
        <NumberStepper label="Folded columns" value={sizes.foldedColumns} min={1} max={MAX_CELLS} onChange={set("foldedColumns")} />
        <NumberStepper label="Folded rows" value={sizes.foldedRows} min={1} max={MAX_CELLS} onChange={set("foldedRows")} />
        <NumberStepper label="Stack limit" value={sizes.stackLimit} min={1} max={MAX_STACK} onChange={set("stackLimit")} />
      </div>
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
