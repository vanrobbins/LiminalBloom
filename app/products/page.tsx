// The product list, scoped to the store you are signed in to.
//
// This is where section 8.2 becomes real: the query filters on store_id from
// the session, so a member of one store cannot see another's products even by
// guessing a URL. The filter lives on the server; there is no request the
// browser can make that skips it.
//
// Still scaffolding for the real Product Search screen in 3.2.

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { StoreSwitcher } from "@/components/store-switcher";
import { db } from "@/db";
import { products } from "@/db/schema";
import { resolveActiveStore } from "@/lib/active-store";
import { auth } from "@/lib/auth";

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
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect("/sign-in");
  }

  // The session's store, but only while this person still belongs to it;
  // otherwise the same rule sign-in uses. Covers sessions opened before the
  // active-store hook existed, and people removed from a store elsewhere.
  // Read-only: a page cannot set cookies.
  const storeId = await resolveActiveStore(
    session.user.id,
    session.session.activeOrganizationId,
  );

  // A signed-in person who belongs to no store has nothing to look at yet.
  if (!storeId) {
    redirect("/create-store");
  }

  // Name the store being shown, not simply the first one they belong to.
  const stores = await auth.api.listOrganizations({ headers: requestHeaders });
  const store = stores.find((s) => s.id === storeId);

  const storeProducts = await db
    .select()
    .from(products)
    .where(eq(products.storeId, storeId))
    .orderBy(products.name);

  return (
    <main className="min-h-screen bg-surface px-4 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <StoreSwitcher
            stores={stores.map(({ id, name }) => ({ id, name }))}
            activeStoreId={storeId}
          />
        </div>
        <p className="text-sm font-medium text-brand-strong">
          {store?.name ?? "Your store"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Product library
        </h1>
        <p className="mt-2 text-ink-muted">
          {storeProducts.length}{" "}
          {storeProducts.length === 1 ? "product" : "products"} in this store.
        </p>

        {storeProducts.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">
            No products yet. A store starts empty, and only ever shows its own.
          </p>
        ) : (
          <ProductList
            products={storeProducts.map(
              ({ id, name, styleNumber, category, color, status }) => ({
                id,
                name,
                styleNumber,
                category,
                color,
                status,
              }),
            )}
          />
        )}
      </div>
    </main>
  );
}
