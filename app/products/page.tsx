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

import { db } from "@/db";
import { products } from "@/db/schema";
import { auth } from "@/lib/auth";

// Without this, Next.js prerenders the page once at build time and the list
// would be frozen at whatever the database held when `npm run build` ran.
// Product status has to be current (section 3.2), so render on every request.
//
// This option is only available because Cache Components is off in
// next.config.ts. If that is ever enabled, this moves to `use cache`
// directives instead -- see node_modules/next/dist/docs.
export const dynamic = "force-dynamic";

// How each status should read on screen. Status is never colour alone,
// per section 5.5 of the proposal.
const statusLabel = {
  in_stock: "In stock",
  sold_out: "Sold out",
  on_sale: "On sale",
} as const;

export default async function ProductsPage() {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect("/sign-in");
  }

  // A signed-in person who belongs to no store has nothing to look at yet.
  const storeId = session.session.activeOrganizationId;
  if (!storeId) {
    redirect("/create-store");
  }

  const [store] = await auth.api.listOrganizations({ headers: requestHeaders });

  const storeProducts = await db
    .select()
    .from(products)
    .where(eq(products.storeId, storeId))
    .orderBy(products.name);

  return (
    <main className="min-h-screen bg-surface px-6 py-16">
      <div className="mx-auto w-full max-w-2xl">
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
          <ul className="mt-8 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
            {storeProducts.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-raised px-4 py-3"
              >
                <span className="font-medium text-ink">
                  {product.name}
                </span>
                <span className="font-mono text-sm text-ink-muted">
                  {product.styleNumber}
                </span>
                <span className="text-sm text-ink-muted">
                  {product.category} &middot; {product.color}
                </span>
                <span className="text-sm font-medium text-brand-strong">
                  {statusLabel[product.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
