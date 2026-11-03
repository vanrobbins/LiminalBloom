// Search results as location-first cards (Part 2 spec §6); the empty state
// says why nothing matched.

import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/lib/products/queries";

import { SearchCard } from "./search-card";
import { SearchCardMenu } from "./search-card-menu";

type SearchResultsProps = {
  results: SearchResult[];
  /** The product whose location is open beside the list, if any. */
  openId?: string | null;
  query: string;
  hasFilters: boolean;
  onOpen: (productId: string) => void;
  onClear: () => void;
  /** Cards get a ⋯ menu (Edit, Delete); the screen passes this from 1024 px only. */
  onDeleted?: (productId: string) => void;
  /** The store has no products at all, so the empty state says how to start. */
  isCatalogEmpty?: boolean;
};

export function SearchResults({ results, openId = null, query, hasFilters, onOpen, onClear, onDeleted, isCatalogEmpty = false }: SearchResultsProps) {
  if (results.length === 0 && isCatalogEmpty) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">
        No products yet. Add the first one, or set up categories.
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-8 text-center">
        <p className="text-ink">{query ? `No products match “${query}”.` : "No products match these filters."}</p>
        {hasFilters ? (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">Try fewer letters, or the style number.</p>
        )}
      </div>
    );
  }

  return (
    // Two columns follow this column's width, not the viewport's: an open panel
    // narrows it, and a card needs about 300 px for the name beside the badge.
    <div className="@container mt-4">
      <ul className="grid gap-3 @2xl:grid-cols-2">
        {results.map((r) => (
          <li key={r.id} className="relative">
            <SearchCard result={r} isOpen={r.id === openId} onOpen={onOpen} hasMenu={onDeleted !== undefined} />
            {onDeleted ? (
              <div className="absolute top-2 right-2">
                <SearchCardMenu productId={r.id} version={r.version} name={r.name} onDeleted={onDeleted} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
