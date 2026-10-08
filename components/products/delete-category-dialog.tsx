// Deleting a category deletes its products (DECISIONS 10-04), so the dialog
// says how many first and sends that number back. If it changed meanwhile, the
// server refuses and the dialog shows the new number instead.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeCategory } from "@/app/(app)/products/categories/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { CategoryRow } from "@/lib/products/queries";

type DeleteCategoryDialogProps = {
  category: CategoryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

const products = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

export function DeleteCategoryDialog({ category, open, onOpenChange, onDeleted }: DeleteCategoryDialogProps) {
  const [count, setCount] = useState(category.productCount);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // The category changed elsewhere: this dialog's version is stale for good.
  const [isStale, setIsStale] = useState(false);
  const router = useRouter();

  async function confirm() {
    setIsDeleting(true);
    try {
      const result = await removeCategory(category.id, category.version, count);
      if (result.status === "count-changed") {
        setCount(result.count);
        setNotice("Someone added or removed products meanwhile. Check the new count.");
        return;
      }
      if (result.status === "conflict") {
        setIsStale(true);
        setNotice("This category changed on another device. Close and look again.");
        return;
      }
      onDeleted();
    } catch {
      setNotice("Couldn't delete this category. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && isStale) router.refresh();
        onOpenChange(isOpen);
      }}
      title={`Delete ${category.name}?`}
      description={count > 0 ? `This also deletes its ${products(count)}, with their locations and images. This can't be undone.` : undefined}
    >
      {notice ? (
        <p role="status" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Button variant="danger" onClick={confirm} loading={isDeleting} loadingText="Deleting…" disabled={isStale}>
        {count > 0 ? `Delete category and ${products(count)}` : "Delete category"}
      </Button>
    </Dialog>
  );
}
