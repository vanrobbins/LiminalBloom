// The product list, scoped to the store you are working in.
//
// This is where section 8.2 becomes real: the query filters on the store id
// from requireMember(), which is membership-checked on every request, so a
// member of one store cannot see another's products even by guessing a URL.
// The filter lives on the server; there is no request the browser can make
// that skips it.
//
// Still scaffolding for the real Product Search screen in 3.2. The store
// switcher lives in the app shell (components/shell/).

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { requireMember } from "@/lib/current-member";

import { ProductList } from "./product-list";

// Without this, Next.js prerenders the page once at build time and the list
// would be frozen at whatever the database held when `npm run build` ran.
// Product status has to be current (section 3.2), so render on every request.
//
// This option is only available because Cache Components is off in
// next.config.ts. If that is ever enabled, this moves to `use cache`
// directives instead -- see node_modules/next/dist/docs.
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  // Redirects a signed-out visitor to sign in, and someone with no store to
  // create one.
  const { stores, activeStoreId } = await requireMember();
  const store = stores.find((s) => s.id === activeStoreId);

  const storeProducts = await db
    .select()
    .from(products)
    .where(eq(products.storeId, activeStoreId))
    .orderBy(products.name);

  return (
    <>
      <p className="text-sm font-medium text-brand-strong">{store?.name ?? "Your store"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Product library</h1>
      <p className="mt-2 text-ink-muted">
        {storeProducts.length} {storeProducts.length === 1 ? "product" : "products"} in this
        store.
      </p>

      {storeProducts.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">
          No products yet. A store starts empty, and only ever shows its own.
        </p>
      ) : (
        <ProductList
          products={storeProducts.map(({ id, name, styleNumber, category, color, status }) => ({
            id,
            name,
            styleNumber,
            category,
            color,
            status,
          }))}
        />
      )}
    </>
  );
}
