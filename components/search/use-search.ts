// The search box's state (spec §7.2): debounced, newest answer wins, and a
// failed request keeps what is on screen rather than blanking it.

"use client";

import { useEffect, useRef, useState } from "react";

import { runSearch } from "@/app/(app)/search/actions";
import type { ProductRow, SearchResult } from "@/lib/products/queries";
import type { SearchInput } from "@/lib/products/schemas";
import { toSearchParams } from "@/lib/products/search-params";

export const DEBOUNCE_MS = 150;

export function useSearch(initial: SearchInput, initialResults: SearchResult[]) {
  const [input, setInput] = useState(initial);
  const [results, setResults] = useState(initialResults);
  const [isPending, setIsPending] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  // A pending search must not fire after the screen is gone.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function run(next: SearchInput) {
    const ticket = ++latest.current;
    setIsPending(true);
    try {
      const found = await runSearch(next);
      if (ticket !== latest.current) return;
      if (found) setResults(found);
      setIsOffline(false);
    } catch {
      if (ticket === latest.current) setIsOffline(true);
    } finally {
      if (ticket === latest.current) setIsPending(false);
    }
  }

  function update(change: Partial<SearchInput>) {
    const next = { ...input, ...change };
    setInput(next);
    // The native History API keeps Next's router in step without a server round trip.
    const query = toSearchParams(next).toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(next), DEBOUNCE_MS);
  }

  // Merges by id into the latest list, so an Undo that lands after the sheet
  // closed still updates the row.
  function patchProduct(product: ProductRow) {
    setResults((list) => list.map((r) => (r.id === product.id ? { ...r, ...product } : r)));
  }

  return { input, results, isPending, isOffline, update, patchProduct };
}
