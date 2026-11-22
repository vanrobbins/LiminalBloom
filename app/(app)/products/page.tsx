// Products (§3.2, Week 6.5 spec §2): find a product and manage the catalog
// from one screen. The first results render on the server from the URL, so a
// shared or refreshed link shows them straight away. /search redirects here.

import { SearchScreen } from "@/components/search/search-screen";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { listCategories, listColors, search } from "@/lib/products/queries";
import { fromSearchParams, toSearchParams } from "@/lib/products/search-params";
import { uuidParam } from "@/lib/url-params";

// Status changes on other devices must show on every visit (§3.2 item 8).
export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const member = await requireMember();
  const { activeStoreId } = member;
  const params = await searchParams;
  const initial = fromSearchParams(params);
  const [page, categories, colors, layout] = await Promise.all([
    search(activeStoreId, initial),
    listCategories(activeStoreId),
    listColors(activeStoreId),
    loadLayout(activeStoreId),
  ]);
  // ?open= (the command palette's Product result) opens a card only if it is in these first results.
  const requested = uuidParam(params, "open");
  const openId = requested && page.results.some((r) => r.id === requested) ? requested : undefined;
  return (
    // Next keeps client state when only the search params change, so a link to
    // /products?q=… would keep the old query. Keying on the URL remounts on real
    // navigations; typing only uses replaceState, which does not re-render here.
    // A store switch keeps the URL, so the store is in the key too: otherwise the
    // refreshed page keeps showing the last store's results under the new name.
    <SearchScreen
      key={`${activeStoreId}?${toSearchParams(initial)}&open=${openId ?? ""}`}
      initial={initial}
      initialResults={page.results}
      initialTotal={page.total}
      initialOpenId={openId}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      colors={colors}
      layout={layout}
      member={member}
      // Every product belongs to a category, so their counts add up to the catalog.
      isCatalogEmpty={categories.every((c) => c.productCount === 0)}
    />
  );
}
