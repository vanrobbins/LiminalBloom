// Which store a session opens in (docs/DECISIONS.md, 2026-09-29; 2026-11-22 for companies).
//
// A person can reach several stores: their own memberships, and the stores of the company they hold a role in.
// Signing in opens the one they used last, as long as they still reach it; otherwise the one they joined
// first; otherwise the company's first store by name; otherwise none. The same merge resolveAccess uses
// decides it (lib/access/resolve-merge.ts), so sign-in and every request agree. A paused store, or one of a
// paused company, is never chosen.
//
// Server only in practice, but deliberately without `import "server-only"`: lib/auth.ts imports this file,
// and the Better Auth CLI loads lib/auth.ts outside Next.js to generate the schema, where that import throws.
// Switching to a store (`setActiveStore`) is in lib/access/set-active-store.ts for that reason.

import { readGrants } from "@/lib/access/grants";
import { mergeAccess } from "@/lib/access/resolve-merge";

/** The store to make active for this person, or null if they reach none. */
export async function chooseActiveStore(userId: string): Promise<string | null> {
  return mergeAccess(await readGrants(userId), {}).activeStoreId;
}

/**
 * For the sign-in hook (lib/auth.ts). A database error here must not fail the
 * sign-in itself (B6): with no store chosen, resolveAccess makes the same
 * choice on the next request.
 */
export async function storeForNewSession(userId: string): Promise<string | null> {
  try {
    return await chooseActiveStore(userId);
  } catch (error) {
    console.error("sign-in: no store chosen", error);
    return null;
  }
}
