// Setup for database tests that need roles. A test store is made without
// Better Auth, so the hook has not run; it gets its roles from the same function.
// Rows are written as the owner, which row-level security does not restrict.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { makeStore } from "@/lib/products/test-stores";

import type { BuiltinRoleKey } from "./roles";
import { giveStoreItsRoles } from "./seed";

export type StoreRoles = Record<BuiltinRoleKey, string>;

/** The five built-in roles, made by the real function the creation hook uses. Returns each one's id. */
export async function seedBuiltinRoles(storeId: string): Promise<StoreRoles> {
  await giveStoreItsRoles(storeId);
  const rows = await db.select({ id: roleDefinitions.id, builtin: roleDefinitions.builtin }).from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId));
  return Object.fromEntries(rows.map((r) => [r.builtin, r.id])) as StoreRoles;
}

export async function makeStoreWithRoles(label: string): Promise<{ store: string; roles: StoreRoles }> {
  const store = await makeStore(label);
  return { store, roles: await seedBuiltinRoles(store) };
}

const people: string[] = [];

/**
 * A person in a store, with two-factor on: the built-in managers' roles require it (0.7.1a), and the tests that
 * go through the real guards are not about that. A test of the requirement itself turns it off for the person.
 * `betterAuthRole` is Better Auth's own `member.role`, which can hold a comma-separated list.
 */
export async function makePerson(
  storeId: string,
  roleId: string | null,
  betterAuthRole = "member",
): Promise<{ userId: string; memberId: string }> {
  const userId = `test_acc_${randomUUID().slice(0, 8)}`;
  const memberId = randomUUID();
  people.push(userId);
  await db.insert(user).values({ id: userId, name: "Test person", email: `${userId}@example.com`, twoFactorEnabled: true });
  await db.insert(member).values({ id: memberId, organizationId: storeId, userId, role: betterAuthRole, roleId, createdAt: new Date() });
  return { userId, memberId };
}

/** A pending invitation to a store, optionally naming a role, sent by `inviterId`. */
export async function makeInvitation(storeId: string, inviterId: string, roleId: string | null): Promise<string> {
  const id = randomUUID();
  await db.insert(invitation).values({
    id,
    organizationId: storeId,
    email: `${id}@example.com`,
    roleId,
    expiresAt: new Date(Date.now() + 48 * 3_600_000),
    inviterId,
  });
  return id;
}

/** Removes the people made above. Call after `dropStores`, which removes their memberships. */
export async function dropPeople(): Promise<void> {
  if (people.length === 0) return;
  await db.delete(user).where(inArray(user.id, people.splice(0)));
}
