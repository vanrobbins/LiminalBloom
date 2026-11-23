// What the person asking may do in the store they are working in (spec 0.7, 4.6; 0.7.1, 4.2). Called once
// per request from lib/current-member.ts. Nothing here is cached beyond the request, so a role edit, a
// removed company role or a paused store takes effect on the person's next request with no sign-out.
//
// grants.ts reads what the person is granted (member rows, the company role and its stores, both pause
// filters); resolve-merge.ts is the pure merge. This file is the entry point plus one safety net.

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";

import { readGrants } from "./grants";
import { mergeAccess, type Access, type Grants, type SessionPointers } from "./resolve-merge";
import { giveStoreItsRoles } from "./seed";

export type { Access, CompanyAccess, ResolvedRole, SessionPointers, StoreInfo } from "./resolve-merge";

async function storeHasRoles(storeId: string): Promise<boolean> {
  const rows = await db.select({ id: roleDefinitions.id }).from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).limit(1);
  return rows.length > 0;
}

/**
 * The stores the person reaches, the one this request works in, and their role and switches there. The active
 * store is the session's own pointer only while the person still reaches it (removing someone from a store only
 * clears the remover's session, so another session may still name it); otherwise the first of the older
 * session pointer, the remembered store, the store joined first, and the company's first store by name.
 * A member with no role, or none that exists, gets `view` only: nothing fails open.
 *
 * Safety net: a store created by old code between a migration and a deploy has no roles at all. Only then, and
 * only once, it is given them and read again. A store that has roles is never touched, whatever a member's
 * role_id says.
 */
export async function resolveAccess(userId: string, session: SessionPointers): Promise<Access> {
  let grants = await readGrants(userId);
  let access = mergeAccess(grants, session);
  if (!(await needsRoles(grants, access.activeStoreId))) return access;

  // Two first requests can both get here; the loser's insert may hit a unique constraint. That means the other
  // request seeded the store, so carry on to the second read. If nothing was seeded, failing closed to `view` is safe.
  try {
    await giveStoreItsRoles(access.activeStoreId!);
  } catch (error) {
    console.error("resolveAccess: seeding roles failed for store", access.activeStoreId, error);
  }
  grants = await readGrants(userId);
  access = mergeAccess(grants, session);
  return access;
}

async function needsRoles(grants: Grants, storeId: string | null): Promise<boolean> {
  if (!storeId) return false;
  const asMember = grants.members.find((m) => m.id === storeId);
  return !!asMember && asMember.role === null && !(await storeHasRoles(storeId));
}
