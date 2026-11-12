// One demo account for each built-in role, in the demo store, so a walkthrough
// can sign in as each and show what that role sees (spec 0.7, 4.10). Safe to
// re-run: an account that exists is kept, and its role is put back.
//
// The accounts share the demo password (DEMO_PASSWORD) with the demo account.
// This file must be imported only after target.ts has chosen the database,
// like build.ts: the connection is made when @/db loads.

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { BUILTIN_ROLES, type BuiltinRoleKey } from "@/lib/access/roles";
import { auth } from "@/lib/auth";
import { requiredEnv } from "@/lib/env";

export type DemoPerson = { key: BuiltinRoleKey; name: string; email: string };

/** Top rank first, one per built-in role: `demo.store.manager@liminalbloom.app`, and so on. */
export const DEMO_PEOPLE: DemoPerson[] = BUILTIN_ROLES.map(({ key, name }) => ({
  key,
  name: `Demo ${name}`,
  email: `demo.${key.replace(/_/g, ".")}@liminalbloom.app`,
}));

/** Makes the person a member of the store with the built-in role, or moves an existing member into it. */
export async function placeDemoPerson(storeId: string, userId: string, key: BuiltinRoleKey): Promise<void> {
  const [role] = await db
    .select({ id: roleDefinitions.id })
    .from(roleDefinitions)
    .where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.builtin, key)));
  if (!role) throw new Error(`The demo store has no ${key} role.`);
  const [existing] = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, storeId), eq(member.userId, userId)));
  if (existing) {
    await db.update(member).set({ roleId: role.id }).where(eq(member.id, existing.id));
    return;
  }
  // Better Auth's own role stays "member": the app reads role_id, never this column (docs/DECISIONS.md, 2026-09-28).
  await db.insert(member).values({ id: randomUUID(), organizationId: storeId, userId, role: "member", roleId: role.id, createdAt: new Date() });
}

/**
 * Production sign-up is open and email is unverified, so anyone may have registered
 * a demo address before the seed first ran. The seed hands that account a role, so
 * it adopts an existing account only if it is already in the demo store or still has
 * the demo password (it is ours); otherwise it stops and names the address.
 */
async function checkOurs(storeId: string, accountId: string, person: DemoPerson): Promise<void> {
  const [there] = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, storeId), eq(member.userId, accountId)));
  if (there) return;
  try {
    await auth.api.signInEmail({ body: { email: person.email, password: requiredEnv("DEMO_PASSWORD") } });
  } catch {
    throw new Error(`${person.email} already has an account that is not in the demo store and does not use the demo password, so it may not be ours. Nothing was changed. Remove that account, then run this again.`);
  }
}

type Options = { isProduction?: boolean; people?: DemoPerson[] };

export async function seedDemoPeople(storeId: string, { isProduction = false, people = DEMO_PEOPLE }: Options = {}): Promise<number> {
  // Every existing account is checked before any role is placed, so a refusal leaves the store as it was.
  const existing = new Map<string, string>();
  for (const person of people) {
    const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, person.email));
    if (!account) continue;
    if (isProduction) await checkOurs(storeId, account.id, person);
    existing.set(person.email, account.id);
  }
  for (const person of people) {
    let accountId = existing.get(person.email);
    if (!accountId) {
      const created = await auth.api.signUpEmail({ body: { email: person.email, password: requiredEnv("DEMO_PASSWORD"), name: person.name } });
      accountId = created.user.id;
    }
    await placeDemoPerson(storeId, accountId, person.key);
  }
  return people.length;
}
