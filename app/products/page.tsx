// A temporary page proving the database round-trip: /products
//
// This is a Server Component -- it runs on the server only, so it can query
// the database directly. The connection string never reaches the browser.
// Note the `async` on the function: that is what lets us `await` the query.
//
// This page is scaffolding for Week 1, not the real Product Search screen
// from section 3.2. It gets replaced when search is built.

import { db } from "@/db";
import { products } from "@/db/schema";

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
  const allProducts = await db.select().from(products).orderBy(products.name);

  return (
    <main className="min-h-screen bg-[#F7F2EA] px-6 py-16 dark:bg-[#16120F]">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[#231D18] dark:text-[#F7F2EA]">
          Product library
        </h1>
        <p className="mt-2 text-[#231D18]/70 dark:text-[#F7F2EA]/70">
          {allProducts.length} products, read live from Neon.
        </p>

        <ul className="mt-8 flex flex-col gap-px overflow-hidden rounded-lg border border-[#231D18]/10 bg-[#231D18]/10 dark:border-[#F7F2EA]/10 dark:bg-[#F7F2EA]/10">
          {allProducts.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-[#FBF7F0] px-4 py-3 dark:bg-[#231D18]"
            >
              <span className="font-medium text-[#231D18] dark:text-[#F7F2EA]">
                {product.name}
              </span>
              <span className="font-mono text-sm text-[#231D18]/60 dark:text-[#F7F2EA]/60">
                {product.styleNumber}
              </span>
              <span className="text-sm text-[#231D18]/70 dark:text-[#F7F2EA]/70">
                {product.category} &middot; {product.color}
              </span>
              <span className="text-sm font-medium text-[#6E5210] dark:text-[#E8B93A]">
                {statusLabel[product.status]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
