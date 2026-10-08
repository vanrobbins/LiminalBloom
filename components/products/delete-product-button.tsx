// Deleting a product after a confirmation (spec §5.3): its places and
// overrides go with it, and its image is removed after the database commits.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeProduct } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

export function DeleteProductButton({ productId, version, name }: { productId: string; version: number; name: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirm() {
    setIsDeleting(true);
    try {
      const result = await removeProduct(productId, version);
      if (result.status === "conflict") {
        setIsOpen(false);
        toast({ tone: "error", title: "Changed on another device", description: "Look it over, then delete it if you still want to." });
        router.refresh();
        return;
      }
      toast({ tone: "success", title: `Deleted ${name}` });
      router.push("/products");
    } catch {
      toast({ tone: "error", title: "Couldn't delete", description: "Check your connection and try again." });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        Delete product
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen} title={`Delete ${name}?`} description="Its places on fixtures and in the stockroom go with it. This can't be undone.">
        <Button variant="danger" onClick={confirm} loading={isDeleting} loadingText="Deleting…">
          Delete product
        </Button>
      </Dialog>
    </>
  );
}
