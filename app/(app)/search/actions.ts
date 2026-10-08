"use server";

// Search as you type (spec §7.2): parsed here, scoped to the session's store.

import { requireMember } from "@/lib/current-member";
import { search, type SearchResult } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

/** Null when the input doesn't parse: the screen keeps what it shows rather than browsing everything. */
export async function runSearch(raw: unknown): Promise<SearchResult[] | null> {
  const { activeStoreId } = await requireMember();
  const parsed = searchInput.safeParse(raw);
  return parsed.success ? search(activeStoreId, parsed.data) : null;
}
