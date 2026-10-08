// Each result names its place (§3.2 items 4–6): fixture and cell, hung or
// folded, and status as a word with an icon.

import { ProductImage } from "@/components/products/product-image";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import type { SearchResult } from "@/lib/products/queries";

type SearchResultsProps = {
  results: SearchResult[];
  /** The product whose location is open beside the list, if any. */
  openId?: string | null;
  query: string;
  hasFilters: boolean;
  onOpen: (productId: string) => void;
  onClear: () => void;
};

// §5.5: gold marks the current selection, as a bar at the row's edge so the
// status pill never sits on gold. Open and closed never share a class.
const OPEN = "bg-surface shadow-[inset_4px_0_0_var(--color-brand)]";
const CLOSED = "bg-raised";

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
    <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
      {results.map((r) => {
        const [first, ...rest] = r.locations;
        return (
          <li key={r.id}>
            <button
              type="button"
              data-result-id={r.id}
              aria-current={r.id === openId ? "true" : undefined}
              onClick={() => onOpen(r.id)}
              className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${r.id === openId ? OPEN : CLOSED}`}
            >
              <ProductImage productId={r.id} name={r.name} categoryName={r.categoryName} imageKey={r.imageKey} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-ink break-words">{r.name}</span>
                <span className="text-sm text-ink-muted">
                  {r.styleNumber} · {r.color}
                </span>
                {first ? (
                  <span className="flex flex-wrap gap-x-2 font-mono text-sm font-semibold text-ink">
                    <span>
                      {first.label} · {PRESENTATION_LABEL[first.presentation]}
                    </span>
                    {rest.length > 0 ? <span className="font-sans font-normal text-ink-muted">+{rest.length} more</span> : null}
                  </span>
                ) : (
                  <span className="text-sm text-ink-muted">Not placed</span>
                )}
              </span>
              <StatusBadge status={r.status} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
