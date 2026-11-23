// Which stores are paused (spec 0.7.1 7.4). A row in `store_suspensions` means Liminal Bloom paused the store:
// it never resolves for anyone, drops out of the switcher, and someone whose only stores are paused is
// sent to /paused. Nothing is deleted. Read as the table owner with the ids filtered by hand.
//
// Deliberately without `import "server-only"`: lib/active-store.ts uses this and lib/auth.ts imports that,
// and the Better Auth CLI loads lib/auth.ts outside Next.js.

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { member, organization } from "@/db/auth-schema";
import { storeSuspensions } from "@/db/schema";

/** The paused ones among these stores. */
export async function pausedAmong(storeIds: readonly string[]): Promise<Set<string>> {
  if (storeIds.length === 0) return new Set();
  const rows = await db.select({ id: storeSuspensions.storeId }).from(storeSuspensions).where(inArray(storeSuspensions.storeId, [...storeIds]));
  return new Set(rows.map((r) => r.id));
}

/** The paused stores this person belongs to, by name: what /paused says. */
export async function pausedStoresOf(userId: string): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(storeSuspensions, eq(storeSuspensions.storeId, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(organization.name);
}
