// The search box's state (spec §7.2): debounced, newest answer wins, and a
// failed request keeps what is on screen rather than blanking it.

"use client";

import { useEffect, useRef, useState } from "react";

import { runSearch } from "@/app/(app)/products/search-actions";
import type { ProductRow, SearchResult } from "@/lib/products/queries";
import type { SearchInput } from "@/lib/products/schemas";
import { toSearchParams } from "@/lib/products/search-params";

export const DEBOUNCE_MS = 150;

export function useSearch(initial: SearchInput, initialResults: SearchResult[], initialTotal: number) {
  const [input, setInput] = useState(initial);
  const [results, setResults] = useState(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [isPending, setIsPending] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  // A pending search must not fire after the screen is gone.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function run(next: SearchInput) {
    const ticket = ++latest.current;
    setIsPending(true);
    // A new search overtakes a Show more still on its way.
    setIsLoadingMore(false);
    try {
      const found = await runSearch(next);
      if (ticket !== latest.current) return;
      if (found) {
        setResults(found.results);
        setTotal(found.total);
      }
      setIsOffline(false);
    } catch {
      if (ticket === latest.current) setIsOffline(true);
    } finally {
      if (ticket === latest.current) setIsPending(false);
    }
  }

  /**
   * The next 30, appended (spec §2.2). Resolves to the first new card's id (for
   * focus) and the new counts, or null when nothing new came (overtaken,
   * refused or offline).
   */
  async function showMore(): Promise<{ firstId: string; shown: number; total: number } | null> {
    const ticket = ++latest.current;
    setIsLoadingMore(true);
    try {
      const found = await runSearch({ ...input, offset: results.length });
      if (ticket !== latest.current || !found) return null;
      const seen = new Set(results.map((r) => r.id));
      const fresh = found.results.filter((r) => !seen.has(r.id));
      // Against the latest list, in case a delete landed meanwhile.
      setResults((list) => [...list, ...fresh.filter((r) => !list.some((l) => l.id === r.id))]);
      // Past the end the window count is empty; keep the total we had.
      const nextTotal = found.results.length > 0 ? found.total : total;
      setTotal(nextTotal);
      setIsOffline(false);
      return fresh[0] ? { firstId: fresh[0].id, shown: results.length + fresh.length, total: nextTotal } : null;
    } catch {
      if (ticket === latest.current) setIsOffline(true);
      return null;
    } finally {
      if (ticket === latest.current) setIsLoadingMore(false);
    }
  }

  function update(change: Partial<SearchInput>) {
    // A changed query, filter or sort starts again from the first 30.
    const next = { ...input, ...change, offset: 0 };
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

  /** Drops a deleted product from the list and the count. */
  function removeProduct(productId: string) {
    setResults((list) => list.filter((r) => r.id !== productId));
    setTotal((count) => Math.max(0, count - 1));
  }

  return { input, results, total, isPending, isOffline, isLoadingMore, update, showMore, patchProduct, removeProduct };
}
