// Which stores are paused (spec 0.7.1 7.4). A row in `store_suspensions` means Liminal Bloom paused the store:
// it never resolves for anyone, drops out of the switcher, and someone whose only stores are paused is
// sent to /paused. Nothing is deleted. Read as the table owner with the ids filtered by hand.
//
// Deliberately without `import "server-only"`: lib/active-store.ts uses this and lib/auth.ts imports that,
// and the Better Auth CLI loads lib/auth.ts outside Next.js.

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { member, organization } from "@/db/auth-schema";
import { companies, roleAssignments, storeProfiles, storeSuspensions } from "@/db/schema";

/** The paused ones among these stores. */
export async function pausedAmong(storeIds: readonly string[]): Promise<Set<string>> {
  if (storeIds.length === 0) return new Set();
  const rows = await db.select({ id: storeSuspensions.storeId }).from(storeSuspensions).where(inArray(storeSuspensions.storeId, [...storeIds]));
  return new Set(rows.map((r) => r.id));
}

/**
 * What is paused for this person, by name: what /paused says. A store of theirs with a `store_suspensions` row; a
 * store of theirs whose company is paused (`companies.suspended_at`); and the company itself for a company role
 * (owner or `role_assignments`), who holds no member row and whose role is dropped while the company is paused.
 */
export async function pausedStoresOf(userId: string): Promise<{ id: string; name: string; kind: "store" | "company" }[]> {
  const own = () => db.select({ id: organization.id, name: organization.name }).from(member).innerJoin(organization, eq(organization.id, member.organizationId)).where(eq(member.userId, userId));
  const [byStore, byCompany, owned, assigned] = await Promise.all([
    own().innerJoin(storeSuspensions, eq(storeSuspensions.storeId, member.organizationId)),
    own().innerJoin(storeProfiles, eq(storeProfiles.storeId, member.organizationId)).innerJoin(companies, and(eq(companies.id, storeProfiles.companyId), isNotNull(companies.suspendedAt))),
    db.select({ id: companies.id, name: companies.name }).from(companies).where(and(eq(companies.ownerUserId, userId), isNotNull(companies.suspendedAt))),
    db
      .select({ id: companies.id, name: companies.name })
      .from(roleAssignments)
      .innerJoin(companies, and(eq(companies.id, roleAssignments.companyId), isNotNull(companies.suspendedAt)))
      .where(eq(roleAssignments.userId, userId)),
  ]);
  const found = new Map<string, { id: string; name: string; kind: "store" | "company" }>();
  for (const r of [...byStore, ...byCompany]) found.set(r.id, { id: r.id, name: r.name, kind: "store" });
  for (const r of [...owned, ...assigned]) found.set(r.id, { id: r.id, name: r.name, kind: "company" });
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
