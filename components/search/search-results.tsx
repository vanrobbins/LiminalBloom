// Search results as location-first cards (Part 2 spec §6); the empty state
// says why nothing matched.

import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/lib/products/queries";

import { SearchCard } from "./search-card";

type SearchResultsProps = {
  results: SearchResult[];
  /** The product whose location is open beside the list, if any. */
  openId?: string | null;
  query: string;
  hasFilters: boolean;
  onOpen: (productId: string) => void;
  onClear: () => void;
};

export function SearchResults({ results, openId = null, query, hasFilters, onOpen, onClear }: SearchResultsProps) {
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
          <li key={r.id}>
            <SearchCard result={r} isOpen={r.id === openId} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}
