// Choosing a product's category, or adding one without leaving the form.

"use client";

import { Label } from "radix-ui";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { addCategory } from "@/app/(app)/products/actions";
import type { CategoryRow } from "@/lib/products/queries";

const NEW = "__new__";

type CategorySelectProps = {
  categories: CategoryRow[];
  value: string;
  onChange: (id: string) => void;
  onAdded: (category: CategoryRow) => void;
  error?: string;
};

export function CategorySelect({ categories, value, onChange, onAdded, error }: CategorySelectProps) {
  const id = useId();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function add() {
    setIsSaving(true);
    try {
      const result = await addCategory(name);
      if (result.status === "invalid") {
        setAddError(result.message);
        return;
      }
      onAdded(result.category);
      onChange(result.category.id);
      setIsAdding(false);
      setName("");
      setAddError(undefined);
    } catch {
      setAddError("Couldn't add the category. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Label.Root htmlFor={id} className="text-sm text-ink">
        Category
      </Label.Root>
      <select
        id={id}
        name="categoryId"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => (event.target.value === NEW ? setIsAdding(true) : onChange(event.target.value))}
        className={FIELD_CLASSES}
      >
        {categories.length === 0 ? <option value="">No categories yet</option> : null}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW}>New category…</option>
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Dialog open={isAdding} onOpenChange={setIsAdding} title="New category" description="It starts with the usual footprints; change them on the Categories page.">
        <Input label="Category name" value={name} onChange={(event) => setName(event.target.value)} error={addError} />
        <Button onClick={add} loading={isSaving} loadingText="Adding…">
          Add category
        </Button>
      </Dialog>
    </div>
  );
}
