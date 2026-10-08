// Product Search and Locator (§3.2). The first results render on the server
// from the URL, so a shared or refreshed link shows them straight away.

import { SearchScreen } from "@/components/search/search-screen";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { listCategories, listColors, search } from "@/lib/products/queries";
import { fromSearchParams, toSearchParams } from "@/lib/products/search-params";

// Status changes on other devices must show on every visit (§3.2 item 8).
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { activeStoreId } = await requireMember();
  const initial = fromSearchParams(await searchParams);
  const [results, categories, colors, layout] = await Promise.all([
    search(activeStoreId, initial),
    listCategories(activeStoreId),
    listColors(activeStoreId),
    loadLayout(activeStoreId),
  ]);
  return (
    // Next keeps client state when only the search params change, so a link to
    // /search would keep the old query. Keying on the URL remounts on real
    // navigations; typing only uses replaceState, which does not re-render here.
    <SearchScreen
      key={toSearchParams(initial).toString()}
      initial={initial}
      initialResults={results}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      colors={colors}
      layout={layout}
    />
  );
}
