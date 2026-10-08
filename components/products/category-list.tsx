// The store's categories with their defaults and product counts.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { describeDefaults } from "@/lib/products/footprint";
import type { CategoryRow } from "@/lib/products/queries";
import { toast } from "@/lib/toast";

import { CategoryForm } from "./category-form";
import { DeleteCategoryDialog } from "./delete-category-dialog";

type Open = { kind: "add" } | { kind: "edit"; category: CategoryRow } | { kind: "delete"; category: CategoryRow } | null;

export function CategoryList({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const done = () => {
    close();
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen({ kind: "add" })}>Add category</Button>
      {categories.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">No categories yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 bg-raised px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink wrap-anywhere">{c.name}</span>
                <span className="text-sm text-ink-muted">
                  {describeDefaults(c)} · {c.productCount} {c.productCount === 1 ? "product" : "products"}
                </span>
              </span>
              <Button variant="secondary" onClick={() => setOpen({ kind: "edit", category: c })} aria-label={`Edit ${c.name}`}>
                Edit
              </Button>
              <Button variant="ghost" onClick={() => setOpen({ kind: "delete", category: c })} aria-label={`Delete ${c.name}`}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open?.kind === "add" || open?.kind === "edit"} onOpenChange={(isOpen) => (isOpen ? null : close())} title={open?.kind === "edit" ? `Edit ${open.category.name}` : "New category"}>
        {open?.kind === "edit" ? <CategoryForm key={open.category.id} category={open.category} onDone={done} /> : <CategoryForm onDone={done} />}
      </Dialog>
      {open?.kind === "delete" ? (
        <DeleteCategoryDialog
          key={open.category.id}
          category={open.category}
          open
          onOpenChange={(isOpen) => (isOpen ? null : close())}
          onDeleted={() => {
            toast({ tone: "success", title: `Deleted ${open.category.name}` });
            done();
          }}
        />
      ) : null}
    </>
  );
}
