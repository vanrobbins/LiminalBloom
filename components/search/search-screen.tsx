// Product Search and Locator (§3.2): type, see where it is, open it.

"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { Input } from "@/components/ui/input";
import type { Layout } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";
import type { SearchInput } from "@/lib/products/schemas";
import { hasFilters } from "@/lib/products/search-params";

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
};

export function SearchScreen({ initial, initialResults, categories, colors, layout }: SearchScreenProps) {
  const { input, results, isPending, isOffline, update, patchProduct } = useSearch(initial, initialResults);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = results.find((r) => r.id === openId) ?? null;
  // A newer search left the open product out: forget it, so it can't reopen
  // by itself when a later search brings it back.
  if (openId !== null && open === null) setOpenId(null);
  const clear = () => update({ categoryIds: [], colors: [], statuses: [], places: [] });

  function close() {
    setOpenId(null);
    // The phone's sheet is a dialog and gives focus back itself; the side panel
    // is not, so focus goes back to the row it came from.
    if (!isPhone && openId) document.querySelector<HTMLElement>(`[data-result-id="${openId}"]`)?.focus();
  }

  return (
    // The panel narrows on tablets so the results keep room for whole words.
    <div className={`mx-auto grid w-full gap-6 ${open ? "max-w-6xl md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : "max-w-2xl"}`}>
      <div className="min-w-0">
        <PageHeader title="Search" />
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
            // Straight to typing: the 10-second find starts here (§1.5).
            autoFocus={initial.q === ""}
          />
        </form>
        <SearchFilters input={input} categories={categories} colors={colors} onChange={update} />
        <p className="mt-4 min-h-6 text-sm text-ink-muted" aria-live="polite">
          {isOffline ? "You're offline. These are the last results." : isPending ? "Searching…" : `${results.length} ${results.length === 1 ? "product" : "products"}`}
        </p>
        <SearchResults results={results} openId={open?.id ?? null} query={input.q} hasFilters={hasFilters(input)} onOpen={setOpenId} onClear={clear} />
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
