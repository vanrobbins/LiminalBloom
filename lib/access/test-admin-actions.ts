// Setup for the database tests of the admin actions (spec 0.7.1 7.4): a real actor account (the event's
// actor id is a foreign key), the events a test wrote, and their removal. Test code only.

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accessEvents, platformEvents } from "@/db/schema";
import type { AdminActor } from "@/lib/admin/events";
import { dropStores } from "@/lib/products/test-stores";

import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";

/** An account to act as. It is not in `platform_admins`: the actions trust their guard, which is tested on its own. */
export async function makeActor(name = "Test Admin"): Promise<AdminActor> {
  const { store } = await makeStoreWithRoles("actor");
  const { userId } = await makePerson(store, null);
  return { userId, name };
}

export const eventsFor = (targetId: string) => db.select().from(platformEvents).where(eq(platformEvents.targetId, targetId));
export const storeEvents = (storeId: string) => db.select().from(accessEvents).where(eq(accessEvents.storeId, storeId));

/** platform_events is insert-only, so a test's rows are removed with its triggers off, in one transaction (db/platform.db.test.ts). */
export async function cleanUp(reasons: string[]) {
  await db.batch([
    db.execute(sql`alter table platform_events disable trigger user`),
    ...reasons.map((r) => db.execute(sql`delete from platform_events where reason = ${r}`)),
    db.execute(sql`alter table platform_events enable trigger user`),
  ]);
  await dropStores();
  await dropPeople();
}
