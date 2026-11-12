// Setup shared by the role-write database tests: roles of a test store as stored, a custom role
// inserted as the owner, and the actor the action would build (people-test.ts).

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";

import type { RolesActor } from "./roles-write";
import type { Switch } from "./switches";

export { actorIn, eventsOf, highRankIn, personIn, roleOf } from "./people-test";

export const rolesOf = (store: string) => db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, store)).orderBy(asc(roleDefinitions.rank));
export const roleNamed = async (store: string, name: string) => (await db.select().from(roleDefinitions).where(and(eq(roleDefinitions.storeId, store), eq(roleDefinitions.name, name))))[0];
export const byBuiltin = async (store: string, builtin: string) => (await rolesOf(store)).find((r) => r.builtin === builtin)!;

/** A custom role, made directly as the owner. */
export async function addCustom(store: string, name: string, rank: number, switches: Switch[]) {
  const [row] = await db.insert(roleDefinitions).values({ storeId: store, name, rank, switches }).returning();
  return row;
}

/** An actor above every role who holds exactly these permissions (plus view): the way to test "your role lacks it". */
export function withOnly(actor: RolesActor, ...held: Switch[]): RolesActor {
  return { ...actor, switches: new Set<Switch>(["view", ...held]) };
}
