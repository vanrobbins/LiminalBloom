// What the person asking may do in the store they are working in (spec 0.7,
// 4.6). Called once per request from lib/current-member.ts. Nothing here is
// cached beyond the request, so a role edit takes effect on the person's next
// request with no sign-out.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { resolveActiveStore } from "@/lib/active-store";

import { BUILTIN_ROLES, withLockedSwitches, type BuiltinRoleKey } from "./roles";
import { giveStoreItsRoles } from "./seed";
import { cleanSwitches, type Switch } from "./switches";

export type ResolvedRole = { id: string; name: string; rank: number; builtin: BuiltinRoleKey | null };

export type Access = {
  /** The store the request works in, or null when the person belongs to none. */
  activeStoreId: string | null;
  /** Null when the member has no role (or none that exists in this store). */
  role: ResolvedRole | null;
  /** `view` and nothing else for a member with no role; empty only when there is no store. */
  switches: ReadonlySet<Switch>;
  /** The role asks for two-factor sign-in (0.7.1a). False for a member with no role. */
  requiresTwoFactor: boolean;
};

const VIEW_ONLY: ReadonlySet<Switch> = new Set<Switch>(["view"]);

function builtinKey(stored: string | null): BuiltinRoleKey | null {
  return BUILTIN_ROLES.find((r) => r.key === stored)?.key ?? null;
}

// Runs as the table owner, not through withStore: the store role
// (app_store_user) cannot read Better Auth's `member` table. So the query is
// filtered by hand, by user id and store id, and the role is joined on both the
// store id and the role id (the composite foreign key keeps them consistent;
// the join does not rely on that). Better Auth's own `member.role` is never read.
async function readRole(userId: string, storeId: string): Promise<ResolvedRole & { stored: unknown; requiresTwoFactor: boolean } | null> {
  const [row] = await db
    .select({
      id: roleDefinitions.id,
      name: roleDefinitions.name,
      rank: roleDefinitions.rank,
      builtin: roleDefinitions.builtin,
      stored: roleDefinitions.switches,
      requiresTwoFactor: roleDefinitions.requiresTwoFactor,
    })
    .from(member)
    .innerJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
    .where(and(eq(member.userId, userId), eq(member.organizationId, storeId)));
  return row ? { id: row.id, name: row.name, rank: row.rank, builtin: builtinKey(row.builtin), stored: row.stored, requiresTwoFactor: row.requiresTwoFactor } : null;
}

async function storeHasRoles(storeId: string): Promise<boolean> {
  const rows = await db.select({ id: roleDefinitions.id }).from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).limit(1);
  return rows.length > 0;
}

/**
 * The active store (the same membership-checked choice every page uses) and
 * the person's role and switches in it. A member with no role, or none that
 * exists, gets `view` only: nothing fails open.
 *
 * Safety net: a store created by old code between a migration and a deploy has
 * no roles at all. Only then, and only once, it is given them and read again.
 * A store that has roles is never touched, whatever a member's role_id says.
 */
export async function resolveAccess(userId: string, sessionStoreId: string | null | undefined): Promise<Access> {
  const activeStoreId = await resolveActiveStore(userId, sessionStoreId);
  if (!activeStoreId) return { activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false };

  let found = await readRole(userId, activeStoreId);
  if (!found && !(await storeHasRoles(activeStoreId))) {
    // Two first requests can both get here; the loser's insert may hit a unique
    // constraint. That means the other request seeded the store, so carry on to
    // the second read. If nothing was seeded, failing closed to `view` is safe.
    try {
      await giveStoreItsRoles(activeStoreId);
    } catch (error) {
      console.error("resolveAccess: seeding roles failed for store", activeStoreId, error);
    }
    found = await readRole(userId, activeStoreId);
  }
  if (!found) return { activeStoreId, role: null, switches: VIEW_ONLY, requiresTwoFactor: false };

  const { stored, requiresTwoFactor, ...role } = found;
  return { activeStoreId, role, switches: withLockedSwitches(cleanSwitches(stored), role.builtin), requiresTwoFactor };
}
