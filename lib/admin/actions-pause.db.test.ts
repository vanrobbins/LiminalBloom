// Pause and Restore a store (spec 0.7.1 7.4) against the dev database: a paused store drops out of every
// resolution and nothing is deleted; each action is one statement with its two events, or nothing.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, organization } from "@/db/auth-schema";
import { storeSuspensions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";
import { makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { chooseActiveStore, resolveActiveStore } from "@/lib/active-store";
import { pausedStoresOf } from "@/lib/paused";

import { pauseStore, restoreStore } from "./actions-pause";
import { cleanUp, eventsFor, makeActor, storeEvents } from "@/lib/access/test-admin-actions";

const REASON = "db test: pause and restore";
afterAll(() => cleanUp([REASON]));

const suspension = (storeId: string) => db.select().from(storeSuspensions).where(eq(storeSuspensions.storeId, storeId));

describe("pauseStore", () => {
  it("records the pause, writes both events, and the store stops resolving for its people while nothing is deleted", async () => {
    const actor = await makeActor("Ada Admin");
    const { store, roles } = await makeStoreWithRoles("pause");
    const { userId } = await makePerson(store, roles.sales_associate);
    expect(await resolveActiveStore(userId, store)).toBe(store);

    const outcome = await pauseStore(actor, store, REASON);
    expect(outcome).toMatchObject({ status: "done" });
    expect(await suspension(store)).toEqual([expect.objectContaining({ reason: REASON, suspendedBy: actor.userId, suspendedByName: "Ada Admin" })]);
    expect(await eventsFor(store)).toEqual([expect.objectContaining({ action: "store_paused", targetKind: "store", reason: REASON, actorName: "Ada Admin" })]);
    expect(await storeEvents(store)).toEqual([expect.objectContaining({ event: "store_paused", actorName: "Liminal Bloom", actorId: null })]);

    expect(await resolveActiveStore(userId, store)).toBeNull();
    expect(await chooseActiveStore(userId)).toBeNull();
    expect((await pausedStoresOf(userId)).map((s) => s.id)).toEqual([store]);
    // Nothing deleted: the store, its roles and the membership are all still there.
    expect(await db.select().from(organization).where(eq(organization.id, store))).toHaveLength(1);
    expect(await db.select().from(member).where(eq(member.organizationId, store))).toHaveLength(1);
  });

  it("says already for a store that is paused (no second event, the first reason kept) and gone for one that is not there", async () => {
    const actor = await makeActor();
    const { store } = await makeStoreWithRoles("pause2");
    await pauseStore(actor, store, REASON);
    expect(await pauseStore(actor, store, `${REASON} again`)).toEqual({ status: "already" });
    expect(await eventsFor(store)).toHaveLength(1);
    expect((await suspension(store))[0].reason).toBe(REASON);
    expect(await pauseStore(actor, randomUUID(), REASON)).toEqual({ status: "gone" });
  });

  it("is all or nothing: an event that cannot be written leaves the store unpaused", async () => {
    const { store } = await makeStoreWithRoles("pause3");
    await expect(pauseStore({ userId: randomUUID(), name: "Nobody" }, store, REASON)).rejects.toThrow();
    expect(await suspension(store)).toHaveLength(0);
    expect(await storeEvents(store)).toHaveLength(0);
  });
});

describe("restoreStore", () => {
  it("lifts the pause, writes both events, and the store resolves again", async () => {
    const actor = await makeActor();
    const { store, roles } = await makeStoreWithRoles("restore");
    const { userId } = await makePerson(store, roles.sales_associate);
    await pauseStore(actor, store, REASON);
    expect(await restoreStore(actor, store, REASON)).toMatchObject({ status: "done" });
    expect(await suspension(store)).toHaveLength(0);
    expect((await eventsFor(store)).map((e) => e.action).sort()).toEqual(["store_paused", "store_restored"]);
    expect((await storeEvents(store)).map((e) => e.event).sort()).toEqual(["store_paused", "store_restored"]);
    expect(await resolveActiveStore(userId, store)).toBe(store);
  });

  it("says already for a store that is not paused, writing nothing", async () => {
    const { store } = await makeStoreWithRoles("restore2");
    expect(await restoreStore(await makeActor(), store, REASON)).toEqual({ status: "already" });
    expect(await eventsFor(store)).toHaveLength(0);
  });

  it("is all or nothing: an event that cannot be written leaves the store paused", async () => {
    const { store } = await makeStoreWithRoles("restore3");
    await pauseStore(await makeActor(), store, REASON);
    await expect(restoreStore({ userId: randomUUID(), name: "Nobody" }, store, REASON)).rejects.toThrow();
    expect(await suspension(store)).toHaveLength(1);
  });
});

afterAll(() => dropStores());
