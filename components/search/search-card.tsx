// A search result (Part 2 spec §6): Search is for finding, so where the
// product goes comes first and large, in words; then hung or folded, the exact
// feet and levels, and how many other places it has. Small photo, name and
// status above it. The card opens the location sheet. Gold marks the open one
// as a ring, so the status badge never sits on gold (§5.5).

import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import type { SearchResult } from "@/lib/products/queries";

type SearchCardProps = {
  result: SearchResult;
  isOpen: boolean;
  onOpen: (productId: string) => void;
  /** Room in the top-right corner for the ⋯ menu beside it (1024 px and up). */
  hasMenu?: boolean;
};

export function SearchCard({ result, isOpen, onOpen, hasMenu = false }: SearchCardProps) {
  const [first, ...rest] = result.locations;
  const how = first ? [PRESENTATION_LABEL[first.presentation], first.detail, rest.length > 0 ? `+${rest.length} more` : ""].filter(Boolean).join(" · ") : "";
  return (
    <button
      type="button"
      data-result-id={result.id}
      aria-current={isOpen ? "true" : undefined}
      onClick={() => onOpen(result.id)}
      className={`flex h-full w-full flex-col gap-3 rounded-lg border ${hasMenu ? "pr-16" : ""} border-line-subtle bg-raised p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=true]:border-ink aria-[current=true]:ring-2 aria-[current=true]:ring-brand`}
    >
      <span className="flex items-center gap-3">
        <ProductImage productId={result.id} name={result.name} categoryName={result.categoryName} imageKey={result.imageKey} decorative />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-ink wrap-anywhere">{result.name}</span>
          <span className="text-sm text-ink-muted">
            {result.styleNumber} · {result.color}
          </span>
        </span>
        <StatusBadge status={result.status} />
      </span>
      {first ? (
        <span className="flex flex-col gap-0.5">
          <span className="text-lg leading-snug font-semibold text-ink wrap-anywhere">{first.label}</span>
          <span className="text-sm text-ink-muted">{how}</span>
        </span>
      ) : (
        <span className="text-ink-muted">Not placed</span>
      )}
    </button>
  );
}
