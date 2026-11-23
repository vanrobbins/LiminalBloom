// A paused store never resolves (spec 0.7.1 7.4): the choice sign-in makes, the check every request makes,
// and the list the shell shows all leave it out, and a person whose stores are all paused is told so.
// Real rows, as lib/active-store.test.ts.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { storeSuspensions } from "@/db/schema";
import { resolveAccess } from "@/lib/access/resolve";
import { chooseActiveStore } from "@/lib/active-store";
import { dropPeople, makePerson } from "@/lib/access/test-roles";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { pausedAmong, pausedStoresOf } from "./paused";

/** The store a request whose session names `storeId` works in. */
const activeStoreOf = async (userId: string, storeId: string) => (await resolveAccess(userId, { activeStoreId: storeId })).activeStoreId;

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const pause = (storeId: string) => db.insert(storeSuspensions).values({ storeId, reason: "db test", suspendedByName: "Test" });

/** One person in `count` stores, joined in order (the first joined is the default choice). */
async function personInStores(count: number) {
  const stores: string[] = [];
  for (let i = 0; i < count; i++) stores.push(await makeStore(`paused${i}`));
  const { userId } = await makePerson(stores[0], null);
  for (const [i, store] of stores.slice(1).entries()) {
    await db.insert(member).values({ id: randomUUID(), organizationId: store, userId, role: "member", createdAt: new Date(Date.now() + (i + 1) * 60_000) });
  }
  return { userId, stores };
}

describe("pausedAmong", () => {
  it("names the paused ones among those asked about, and asks nothing for an empty list", async () => {
    const a = await makeStore("pa"), b = await makeStore("pb");
    await pause(b);
    expect([...(await pausedAmong([a, b]))]).toEqual([b]);
    expect((await pausedAmong([])).size).toBe(0);
  });
});

describe("chooseActiveStore", () => {
  it("skips a paused store, even the one joined first or used last", async () => {
    const { userId, stores } = await personInStores(2);
    await pause(stores[0]);
    expect(await chooseActiveStore(userId)).toBe(stores[1]);
    await db.update(user).set({ lastActiveStoreId: stores[0] }).where(eq(user.id, userId));
    expect(await chooseActiveStore(userId)).toBe(stores[1]);
  });

  it("is none when every store is paused, and the store comes back when it is restored", async () => {
    const { userId, stores } = await personInStores(1);
    await pause(stores[0]);
    expect(await chooseActiveStore(userId)).toBeNull();
    await db.delete(storeSuspensions).where(eq(storeSuspensions.storeId, stores[0]));
    expect(await chooseActiveStore(userId)).toBe(stores[0]);
  });
});

describe("resolveActiveStore", () => {
  it("does not honour a session that still names a paused store", async () => {
    const { userId, stores } = await personInStores(2);
    expect(await activeStoreOf(userId, stores[1])).toBe(stores[1]);
    await pause(stores[1]);
    expect(await activeStoreOf(userId, stores[1])).toBe(stores[0]);
    await pause(stores[0]);
    expect(await activeStoreOf(userId, stores[1])).toBeNull();
  });
});

describe("pausedStoresOf", () => {
  it("lists the person's paused stores by name, and only theirs", async () => {
    const { userId, stores } = await personInStores(2);
    const outsider = await makeStore("outsider");
    await pause(stores[1]);
    await pause(outsider);
    expect((await pausedStoresOf(userId)).map((s) => s.id)).toEqual([stores[1]]);
    expect(await pausedStoresOf(randomUUID())).toEqual([]);
  });
});
