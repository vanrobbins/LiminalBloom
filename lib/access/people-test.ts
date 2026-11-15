// Setup shared by the people-write database tests: an actor built the way the
// action builds one (the member's own rank and switches), and people in a store.

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { accessEvents } from "@/db/schema";

import type { PeopleActor } from "./people-write";
import { BUILTIN_ROLES, type BuiltinRoleKey } from "./roles";
import { makePerson, type StoreRoles } from "./test-roles";

export type Setup = { store: string; roles: StoreRoles };

/** The actor as the action builds it: the member's own rank and switches in a real store. */
export async function actorIn({ store, roles }: Setup, key: BuiltinRoleKey): Promise<PeopleActor> {
  const { userId } = await makePerson(store, roles[key]);
  const def = BUILTIN_ROLES.find((r) => r.key === key)!;
  return { userId, name: `Actor ${key}`, rank: def.rank, switches: new Set(def.switches) };
}

export async function personIn({ store, roles }: Setup, key: BuiltinRoleKey) {
  const { memberId, userId } = await makePerson(store, roles[key]);
  await db.update(user).set({ name: `Jane ${key}` }).where(eq(user.id, userId));
  return { memberId, userId, roleId: roles[key] };
}

/** Someone who outranks every built-in. Nobody can yet (0.7.1 adds them), but the last-manager guard must hold anyway. */
export async function highRankIn(s: Setup): Promise<PeopleActor> {
  return { userId: (await makePerson(s.store, null)).userId, name: "Above", rank: 50, switches: new Set(["view", "people.manage"]) };
}

export const roleOf = async (memberId: string) => (await db.select({ r: member.roleId }).from(member).where(eq(member.id, memberId)))[0]?.r;
export const eventsOf = (store: string) => db.select().from(accessEvents).where(eq(accessEvents.storeId, store));
