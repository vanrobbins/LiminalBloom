// Products (§3.2, Week 6.5 spec §2.2): one screen to find a product in
// seconds and manage the catalog. Type, see where it is, open it; Show more
// pages through the rest.

"use client";

import { useEffect, useRef, useState } from "react";

import { ProductsActions } from "@/components/products/products-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { Input } from "@/components/ui/input";
import type { Layout } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import type { SearchInput } from "@/lib/products/schemas";
import { MAX_OFFSET } from "@/lib/products/schemas";
import { hasFilters, resultCount } from "@/lib/products/search-params";

import { LocationSheet } from "./location-sheet";
import { SearchFilters } from "./search-filters";
import { SearchResults } from "./search-results";
import { useSearch } from "./use-search";

type SearchScreenProps = {
  initial: SearchInput;
  initialResults: SearchResult[];
  categories: { id: string; name: string }[];
  colors: string[];
  layout: Layout;
  initialTotal?: number;
  /** The store has no products at all (not just none matching). */
  isCatalogEmpty?: boolean;
};

const DESKTOP_QUERY = "(min-width: 1024px)";

export function SearchScreen({ initial, initialResults, categories, colors, layout, initialTotal = initialResults.length, isCatalogEmpty = false }: SearchScreenProps) {
  const { input, results, total, isPending, isOffline, isLoadingMore, update, showMore, patchProduct, removeProduct } = useSearch(initial, initialResults, initialTotal);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [openId, setOpenId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const [announcement, setAnnouncement] = useState("");
  // Past the offset cap the server would refuse the next page.
  const canShowMore = results.length < total && results.length <= MAX_OFFSET;

  // Straight to typing on a touch screen: the 10-second find starts here (§1.5).
  // With a keyboard, the first Tab belongs to the skip link.
  useEffect(() => {
    if (initial.q === "" && window.matchMedia("(pointer: coarse)").matches) searchBox.current?.focus();
    // Once, on opening: typing changes the query, not the initial one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After Show more, focus goes to the first new card: now if it has rendered,
  // else as soon as it does.
  const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-result-id="${id}"]`);
  useEffect(() => {
    if (!pendingFocus.current) return;
    cardOf(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [results]);

  async function more() {
    const grown = await showMore();
    if (!grown) return;
    const card = cardOf(grown.firstId);
    if (card) card.focus();
    else pendingFocus.current = grown.firstId;
    setAnnouncement(`Showing ${grown.shown.toLocaleString("en-US")} of ${grown.total.toLocaleString("en-US")}`);
  }
  const open = results.find((r) => r.id === openId) ?? null;
  // A newer search left the open product out: forget it, so it can't reopen
  // by itself when a later search brings it back.
  if (openId !== null && open === null) setOpenId(null);
  const clear = () => update({ categoryIds: [], colors: [], statuses: [], places: [] });

  function close() {
    setOpenId(null);
    // The phone's sheet is a dialog and gives focus back itself; the side panel
    // is not, so focus goes back to the card it came from.
    if (!isPhone && openId) document.querySelector<HTMLElement>(`[data-result-id="${openId}"]`)?.focus();
  }

  return (
    // The panel narrows on tablets so the results keep room for whole words.
    <div className={`mx-auto grid w-full gap-6 ${open ? "max-w-6xl md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : "max-w-2xl"}`}>
      <div className="min-w-0">
        <PageHeader title="Products" actions={<ProductsActions />} />
        <form role="search" onSubmit={(event) => event.preventDefault()}>
          <Input
            label="Search products"
            type="search"
            name="q"
            value={input.q}
            onChange={(event) => update({ q: event.target.value })}
            hint="Name, style number, category or color."
            autoComplete="off"
            enterKeyHint="search"
            ref={searchBox}
          />
        </form>
        <SearchFilters input={input} categories={categories} colors={colors} onChange={update} />
        <p className="mt-4 min-h-6 text-sm text-ink-muted" aria-live="polite">
          {isOffline ? "You're offline. These are the last results." : isPending ? "Searching…" : resultCount(results.length, total)}
        </p>
        <SearchResults
          results={results}
          openId={open?.id ?? null}
          query={input.q}
          hasFilters={hasFilters(input)}
          onOpen={setOpenId}
          onClear={clear}
          onDeleted={isDesktop ? removeProduct : undefined}
          isCatalogEmpty={isCatalogEmpty && results.length === 0 && total === 0}
        />
        {canShowMore ? (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => void more()} loading={isLoadingMore} loadingText="Loading more…">
              Show more
            </Button>
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
      <LocationSheet
        result={open}
        layout={layout}
        onClose={close}
        onChanged={patchProduct}
      />
    </div>
  );
}
