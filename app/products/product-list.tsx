// The store's products as tappable rows. Tapping one opens its details in a
// bottom sheet (§5.2) -- a first use of the sheet, and the start of the
// product detail in Product Search (§3.2, Week 3).
//
// Client-side because it holds which product is open. The page around it
// stays a Server Component and does the store-scoped query.

"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Product } from "@/db/schema";

export type ProductSummary = Pick<
  Product,
  "id" | "name" | "styleNumber" | "category" | "color" | "status"
>;

export function ProductList({ products }: { products: ProductSummary[] }) {
  // Kept after closing so the sheet does not go blank while it slides away.
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ul className="mt-8 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
        {products.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setProduct(item);
                setIsOpen(true);
              }}
              className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-raised px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
            >
              <span className="min-w-0 font-medium text-ink wrap-anywhere">{item.name}</span>
              <span className="font-mono text-sm text-ink-muted">{item.styleNumber}</span>
              <StatusBadge status={item.status} />
            </button>
          </li>
        ))}
      </ul>

      <BottomSheet open={isOpen} onOpenChange={setIsOpen} title={product?.name ?? ""}>
        {product ? (
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
            <dt className="text-ink-muted">Style</dt>
            <dd className="font-mono text-ink">{product.styleNumber}</dd>
            <dt className="text-ink-muted">Category</dt>
            <dd className="text-ink">{product.category}</dd>
            <dt className="text-ink-muted">Color</dt>
            <dd className="text-ink">{product.color}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <StatusBadge status={product.status} />
            </dd>
          </dl>
        ) : null}
      </BottomSheet>
    </>
  );
}
