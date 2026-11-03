// Products: one search box over the catalog, a status filter, and cards that
// lead with where each product is. A card opens the product's sheet.

"use client";

import { MapPin, Search } from "lucide-react";
import { useState } from "react";

import { placementOf, searchProducts } from "@/lib/demo/selectors";
import type { Status } from "@/lib/demo/types";
import { locationWords } from "@/lib/demo/words";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FOCUS, STATUS_LOOK, TINT } from "../looks";
import { ScreenTitle } from "../screen-title";
import { StatusChip } from "../status-chip";

type Filter = "all" | Status | "not-placed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...(["in_stock", "sold_out", "on_sale"] as Status[]).map((s) => ({ value: s, label: STATUS_LOOK[s].word })),
  { value: "not-placed", label: "Not placed" },
];

export function ProductsScreen() {
  const { state } = useDemoStore();
  const nav = useNav();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const found = searchProducts(state.products, query).filter((p) =>
    filter === "all" ? true : filter === "not-placed" ? !placementOf(state, p.id) : p.status === filter,
  );

  return (
    <>
      <ScreenTitle title="Products" />
      <label className="flex min-h-11 items-center gap-2 rounded border border-line bg-raised px-3 focus-within:outline-2 focus-within:outline-ink">
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-muted" />
        <span className="sr-only">Search products</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “hi rise pnt” or “indigo”"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted"
        />
      </label>
      <div role="radiogroup" aria-label="Show" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${filter === value ? "border-brand bg-brand font-semibold text-on-brand" : "border-line text-ink"} ${FOCUS}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="text-sm text-ink-muted">
        {found.length} of {state.products.length} products
      </p>
      <ul className="grid gap-2 @xl:grid-cols-2">
        {found.map((product) => {
          const placement = placementOf(state, product.id);
          return (
            <li key={product.id}>
              <button type="button" onClick={() => nav.openSheet(product.id)} className={`flex w-full gap-3 rounded-lg border border-line bg-raised p-2.5 text-left hover:border-ink ${FOCUS}`}>
                <span aria-hidden="true" className={`size-12 shrink-0 rounded ${TINT[product.tone]}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-1 text-xs">
                    <MapPin aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
                    <span className="truncate">{placement ? locationWords(placement) : "Not placed"}</span>
                  </span>
                  <span className="text-sm font-medium">
                    {product.name} <span className="font-mono text-xs font-normal text-ink-muted">{product.style}</span>
                  </span>
                  <span className="self-start">
                    <StatusChip status={product.status} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {found.length === 0 ? <p className="text-sm text-ink-muted">Nothing matches. Try fewer letters.</p> : null}
    </>
  );
}
