// Products (§3.2, Week 6.5 spec §2.2): one screen to find a product in
// seconds and manage the catalog. Type, see where it is, open it; the rest
// load as the end of the list scrolls into view, or with Load more.

"use client";

import { useEffect, useRef, useState } from "react";

import { ProductsActions } from "@/components/products/products-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { Input } from "@/components/ui/input";
import { can, type Holder } from "@/lib/access/can";
import type { Layout } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import type { SearchInput } from "@/lib/products/schemas";
import { MAX_OFFSET } from "@/lib/products/schemas";
import { hasFilters, resultCount } from "@/lib/products/search-params";

import { LocationSheet } from "./location-sheet";
import { SearchFilters } from "./search-filters";
import { SearchResults } from "./search-results";
import { useAutoLoad } from "./use-auto-load";
import { useSearch } from "./use-search";

type SearchScreenProps = {
  initial: SearchInput;
  initialResults: SearchResult[];
  categories: { id: string; name: string }[];
  colors: string[];
  layout: Layout;
  /** Whose switches decide which controls show; the server checks them again. */
  member: Holder;
  initialTotal?: number;
  /** The store has no products at all (not just none matching). */
  isCatalogEmpty?: boolean;
};

const DESKTOP_QUERY = "(min-width: 1024px)";

export function SearchScreen({ initial, initialResults, categories, colors, layout, member, initialTotal = initialResults.length, isCatalogEmpty = false }: SearchScreenProps) {
  const { input, results, total, isPending, isOffline, isLoadingMore, moreFailed, update, showMore, patchProduct, removeProduct } = useSearch(initial, initialResults, initialTotal);
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

  // A search's answer (or its failure) is announced once it lands, as the count line used to
  // do by itself; a page appended by auto-load changes the count line but says nothing.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending) setAnnouncement(isOffline ? "You're offline. These are the last results." : resultCount(results.length, total));
    wasPending.current = isPending;
    // Only a search settling is news; the counts it settles on are read as it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  // After Load more, focus goes to the first new card: now if it has rendered,
  // else as soon as it does. Auto-load leaves focus alone: it fires while scrolling.
  const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-result-id="${id}"]`);
  useEffect(() => {
    if (!pendingFocus.current) return;
    cardOf(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [results]);

  // `byButton`: the worded Load more. It moves focus and announces; auto-load, which fires
  // while scrolling, stays silent (a failure still shows its own alert).
  async function more(byButton: boolean) {
    const grown = await showMore();
    if (!grown || !byButton) return;
    const card = cardOf(grown.firstId);
    if (card) card.focus();
    else pendingFocus.current = grown.firstId;
    setAnnouncement(`Showing ${grown.shown.toLocaleString("en-US")} of ${grown.total.toLocaleString("en-US")}`);
  }
  const end = useAutoLoad(canShowMore && !isLoadingMore && !isPending && !moreFailed, () => void more(false));
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
    <div className={`mx-auto grid w-full gap-6 ${open ? "max-w-6xl md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : "max-w-2xl lg:max-w-5xl"}`}>
      <div className="min-w-0">
        <PageHeader title="Products" actions={<ProductsActions member={member} />} />
        <form role="search" onSubmit={(event) => event.preventDefault()}>
          <SearchFilters input={input} categories={categories} colors={colors} onChange={update}>
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
          </SearchFilters>
        </form>
        <p className="mt-4 min-h-6 text-sm text-ink-muted">
          {isOffline ? "You're offline. These are the last results." : isPending ? "Searching…" : resultCount(results.length, total)}
        </p>
        <SearchResults
          results={results}
          openId={open?.id ?? null}
          query={input.q}
          hasFilters={hasFilters(input)}
          onOpen={setOpenId}
          onClear={clear}
          onDeleted={isDesktop && can(member, "products.edit") ? removeProduct : undefined}
          isCatalogEmpty={isCatalogEmpty && results.length === 0 && total === 0}
          canEdit={can(member, "products.edit")}
        />
        {canShowMore ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div ref={end} aria-hidden="true" />
            <Button variant="secondary" onClick={() => void more(true)} disabled={isPending} loading={isLoadingMore} loadingText="Loading more…">
              Load more
            </Button>
            {moreFailed ? (
              <p role="alert" className="text-sm text-danger">
                Couldn&apos;t load more. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
      <LocationSheet
        result={open}
        layout={layout}
        member={member}
        onClose={close}
        onChanged={patchProduct}
      />
    </div>
  );
}
