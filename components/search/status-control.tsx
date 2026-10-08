// In stock / Sold out / On sale, saved the moment it is tapped, with Undo
// (spec §7.3). The first step of the Week 7 core loop.

"use client";

import { useState } from "react";

import { changeStatus } from "@/app/(app)/search/status-actions";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/product-status";
import type { ProductRow } from "@/lib/products/queries";
import { PRODUCT_STATUSES } from "@/lib/products/schemas";
import { toast } from "@/lib/toast";

export function StatusControl({ product, onChanged }: { product: ProductRow; onChanged: (product: ProductRow) => void }) {
  const [isSaving, setIsSaving] = useState(false);

  async function save(from: ProductRow, status: ProductStatus): Promise<ProductRow | null> {
    setIsSaving(true);
    try {
      const result = await changeStatus(from.id, from.version, status);
      if (result.status === "saved") {
        const next = { ...from, status, version: result.version };
        onChanged(next);
        return next;
      }
      if (result.product) onChanged(result.product);
      toast({ tone: "error", title: "Changed on another device", description: "The current status is shown." });
      return null;
    } catch {
      toast({ tone: "error", title: "Couldn't save the status", description: "Check your connection and try again." });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function choose(status: ProductStatus) {
    if (status === product.status || isSaving) return;
    const previous = product.status;
    const next = await save(product, status);
    if (!next) return;
    toast({
      tone: "success",
      title: `${product.name}: ${PRODUCT_STATUS[status].label}`,
      action: { label: "Undo", onSelect: () => void save(next, previous) },
    });
  }

  return (
    <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-1 rounded-lg border border-line-subtle bg-surface p-1">
      {PRODUCT_STATUSES.map((status) => {
        const { label, icon: Icon } = PRODUCT_STATUS[status];
        const isChecked = product.status === status;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={isChecked}
            disabled={isSaving}
            onClick={() => void choose(status)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm ${isChecked ? "bg-raised font-semibold text-ink shadow-sm" : "text-ink-muted"}`}
          >
            <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
