// The library's rows (spec §5.1): photo, name, style, category and status,
// each opening the product's edit page.

import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import type { ProductRow } from "@/lib/products/queries";

import { ProductImage } from "./product-image";

export function ProductRows({ products }: { products: ProductRow[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
      {products.map((p) => (
        <li key={p.id}>
          <Link
            href={`/products/${p.id}`}
            className="flex min-h-16 items-center gap-3 bg-raised px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            <ProductImage productId={p.id} name={p.name} categoryName={p.categoryName} imageKey={p.imageKey} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-ink wrap-anywhere">{p.name}</span>
              <span className="text-sm text-ink-muted">
                {p.styleNumber} · {p.categoryName} · {p.color}
              </span>
            </span>
            <StatusBadge status={p.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
