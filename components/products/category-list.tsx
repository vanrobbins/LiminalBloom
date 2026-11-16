// The store's categories with their defaults and product counts.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CollapseItem } from "@/components/ui/collapse-item";
import { Dialog } from "@/components/ui/dialog";
import { focusNearRow } from "@/components/ui/focus-near-row";
import { useAnnouncement } from "@/components/ui/use-announcement";
import { useCollapseOut } from "@/components/ui/use-collapse-out";
import { describeDefaults } from "@/lib/products/footprint";
import type { CategoryRow } from "@/lib/products/queries";

import { CategoryForm } from "./category-form";
import { DeleteCategoryDialog } from "./delete-category-dialog";

type Open = { kind: "add" } | { kind: "edit"; category: CategoryRow } | { kind: "delete"; category: CategoryRow } | null;

export function CategoryList({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const { isLeaving, collapse } = useCollapseOut();
  const [said, say] = useAnnouncement();
  // A deletion whose reload failed: the row opens again with this on it.
  // The row whose Delete opened the dialog; when that row is deleted, focus goes to a neighbour instead of back to it.
  const opener = useRef<HTMLElement | null>(null);
  const deleted = useRef(false);
  const close = () => setOpen(null);
  const done = () => {
    close();
    router.refresh();
  };

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
      <Button onClick={() => setOpen({ kind: "add" })}>Add category</Button>
      {categories.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">No categories yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
          {categories.map((c) => (
            <CollapseItem key={c.id} leaving={isLeaving(c.id)} className="flex flex-wrap items-center gap-3 bg-raised px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-ink wrap-break-word">{c.name}</span>
                <span className="text-sm text-ink-muted">
                  {describeDefaults(c)} · {c.productCount} {c.productCount === 1 ? "product" : "products"}
                </span>
              </span>
              <Button variant="secondary" onClick={() => setOpen({ kind: "edit", category: c })} aria-label={`Edit ${c.name}`}>
                Edit
              </Button>
              <Button
                variant="quiet-danger"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setOpen({ kind: "delete", category: c });
                }}
                aria-label={`Delete ${c.name}`}
              >
                Delete
              </Button>
            </CollapseItem>
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
          onCloseAutoFocus={(event) => {
            if (!deleted.current) return;
            deleted.current = false;
            event.preventDefault();
            // No heading on the list: with no neighbour left, the page title.
            focusNearRow(opener.current?.closest("li") ?? null, null);
          }}
          onDeleted={() => {
            // No toast: the row folds shut, then the list reloads without it (0.7.0.5 spec 3.1). Said in the live region.
            const { id, name } = open.category;
            deleted.current = true;
            say(`Deleted ${name}`);
            close();
            collapse(id, () => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}
