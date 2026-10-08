// The product library (spec §5.1), scoped to the store you are working in.
// The filter box is a plain GET form, so it works before any script loads;
// it uses the same trigram search as /search.

import Link from "next/link";

import { ProductRows } from "@/components/products/product-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireMember } from "@/lib/current-member";
import { searchProducts } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

// Status and edits from other devices must show on every visit (section 3.2).
export const dynamic = "force-dynamic";

// The whole catalog, not search's top 30; paging waits for a store that needs it.
const LIBRARY_LIMIT = 1000;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { stores, activeStoreId } = await requireMember();
  const store = stores.find((s) => s.id === activeStoreId);
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await searchProducts(activeStoreId, searchInput.parse({ q: query }), LIBRARY_LIMIT);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-sm font-medium text-brand-strong">{store?.name ?? "Your store"}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Product library</h1>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/products/categories">Categories</Link>
          </Button>
          <Button asChild>
            <Link href="/products/new">Add product</Link>
          </Button>
        </div>
      </div>
      <form role="search" action="/products" className="mt-6">
        <Input label="Filter products" name="q" type="search" defaultValue={query} />
      </form>
      <p className="mt-4 text-ink-muted" aria-live="polite">
        {rows.length} {rows.length === 1 ? "product" : "products"}
        {query ? ` matching “${query}”` : " in this store"}.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">
          {query ? "Nothing matches. Try fewer letters." : "No products yet. Add the first one, or set up categories."}
        </p>
      ) : (
        <ProductRows products={rows} />
      )}
    </div>
  );
}
