// A product in the library (Part 2 spec §6): browsing, so the photo comes
// first and large, then name, category and status. The whole card opens the
// product. Search has its own card (components/search/search-card.tsx), which
// puts where the product goes first.

import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import type { ProductRow } from "@/lib/products/queries";

import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: ProductRow }) {
  return (
    <Link
      href={`/products/${product.id}`}
      data-product-card
      className="flex h-full flex-col overflow-hidden rounded-lg border border-line-subtle bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div className="aspect-5/6 w-full bg-surface">
        <ProductImage productId={product.id} name={product.name} categoryName={product.categoryName} imageKey={product.imageKey} size="fill" decorative />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span data-product-name className="font-medium text-ink wrap-anywhere">
          {product.name}
        </span>
        <span className="text-sm text-ink-muted">
          {product.categoryName} · {product.color}
        </span>
        <span className="mt-auto pt-1">
          <StatusBadge status={product.status} />
        </span>
      </div>
    </Link>
  );
}
