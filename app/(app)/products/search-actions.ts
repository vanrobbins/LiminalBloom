"use server";

// Search as you type (spec §7.2): parsed here, scoped to the session's store.

import { requireSwitchForAction } from "@/lib/current-member";
import { search, type SearchPage } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

/**
 * Null when the input doesn't parse, or when the caller has no access: the screen keeps what it
 * shows rather than browsing everything. Every role holds `view`, so this is a membership check.
 */
export async function runSearch(raw: unknown): Promise<SearchPage | null> {
  const check = await requireSwitchForAction("view");
  if (check.status === "forbidden") return null;
  const parsed = searchInput.safeParse(raw);
  return parsed.success ? search(check.member.activeStoreId, parsed.data) : null;
}
