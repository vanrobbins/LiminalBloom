// Deleting a product after a confirmation (spec §5.3): its places and
// overrides go with it, and its image is removed after the database commits.
// The dialog is shared by the product page's button and the Products card's
// ⋯ menu (Week 6.5 spec §2.2), which keeps the list instead of navigating.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeProduct } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

type Target = { productId: string; version: number; name: string };

type DeleteProductDialogProps = Target & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the delete commits. Defaults to going back to Products. */
  onDeleted?: () => void;
};

export function DeleteProductDialog({ productId, version, name, open, onOpenChange, onDeleted }: DeleteProductDialogProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirm() {
    setIsDeleting(true);
    try {
      const result = await removeProduct(productId, version);
      if (result.status === "conflict") {
        onOpenChange(false);
        toast({ tone: "error", title: "Changed on another device", description: "Look it over, then delete it if you still want to." });
        router.refresh();
        return;
      }
      // No Undo: the image is already gone (spec §2.2).
      toast({ tone: "success", title: `Deleted ${name}` });
      onOpenChange(false);
      if (onDeleted) onDeleted();
      else router.push("/products");
    } catch {
      toast({ tone: "error", title: "Couldn't delete", description: "Check your connection and try again." });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Delete ${name}?`} description="Its places on fixtures and in the stockroom go with it. This can't be undone.">
      <Button variant="danger" onClick={confirm} loading={isDeleting} loadingText="Deleting…">
        Delete product
      </Button>
    </Dialog>
  );
}

export function DeleteProductButton(target: Target) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        Delete product
      </Button>
      <DeleteProductDialog {...target} open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
