// What the palette fetches (spec §7). The index (planograms, zones) comes once per open and is
// kept per store, so the last copy shows while the new one loads. Products come 150 ms after the
// last keystroke, the previous request is aborted, and an answer for an old query is never shown.
// Both are guarded GETs, not server actions, so they can be cancelled and never queue behind a save.

"use client";

import { useEffect, useRef, useState } from "react";
import type { z } from "zod";

import { DEBOUNCE_MS } from "@/components/search/use-search";
import { indexSchema, productsSchema } from "@/lib/palette/schema";
import type { PaletteIndex, PaletteProducts } from "@/lib/palette/types";
import { isTextQuery, normalizeQuery } from "@/lib/products/search-params";

/** The searching row waits this long, so a quick answer never flashes it (spec §5). */
export const SEARCHING_ROW_MS = 300;

export type ProductsState = "idle" | "loading" | "ready" | "error";

type Answer = { key: string; products: PaletteProducts | null };

/** The parsed body, "unauthorized" for a 401, or null for anything else that went wrong (including an abort). */
async function getJson<T>(url: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T | "unauthorized" | null> {
  try {
    const res = await fetch(url, { signal });
    if (res.status === 401) return "unauthorized";
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type Params = { open: boolean; query: string; storeId: string; onUnauthorized: () => void };

export function usePaletteData({ open, query, storeId, onUnauthorized }: Params) {
  const [indexCopy, setIndexCopy] = useState<{ storeId: string; index: PaletteIndex } | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => {
    unauthorized.current = onUnauthorized;
  });

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    void getJson("/api/palette", indexSchema, abort.signal).then((index) => {
      if (abort.signal.aborted) return;
      if (index === "unauthorized") unauthorized.current();
      else if (index) setIndexCopy({ storeId, index });
    });
    return () => abort.abort();
  }, [open, storeId]);

  const q = normalizeQuery(query);
  const wanted = open && isTextQuery(q);
  const key = `${storeId}|${q}`;
  useEffect(() => {
    if (!wanted) return;
    const abort = new AbortController();
    const slow = setTimeout(() => setSlowKey(key), SEARCHING_ROW_MS);
    const fetchTimer = setTimeout(async () => {
      const found = await getJson(`/api/palette/products?${new URLSearchParams({ q })}`, productsSchema, abort.signal);
      if (abort.signal.aborted) return;
      if (found === "unauthorized") unauthorized.current();
      else {
        setAnswer({ key, products: found });
        // Asked for again later, the searching row waits its 300 ms afresh.
        setSlowKey(null);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(slow);
      clearTimeout(fetchTimer);
      abort.abort();
    };
  }, [wanted, key, q]);

  const current = wanted && answer?.key === key ? answer : null;
  const state: ProductsState = !wanted ? "idle" : current ? (current.products ? "ready" : "error") : "loading";
  return {
    index: indexCopy?.storeId === storeId ? indexCopy.index : null,
    products: current?.products ?? null,
    state,
    /** Still waiting, and for long enough to say so. */
    searching: state === "loading" && slowKey === key,
  };
}
