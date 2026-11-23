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
import { assignCompanyRole, dropCompanies, makeBareAccount, makeCompany, makeCompanyStore } from "@/lib/companies/test-companies";
import { companies } from "@/db/schema";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { pausedAmong, pausedStoresOf } from "./paused";

/** The store a request whose session names `storeId` works in. */
const activeStoreOf = async (userId: string, storeId: string) => (await resolveAccess(userId, { activeStoreId: storeId })).activeStoreId;

afterAll(async () => {
  await dropStores();
  await dropCompanies();
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

// A paused company is `companies.suspended_at` (spec 0.7.1 7.4, B10 sets it): none of its stores resolve, and nor
// does the company role, so the read must still say "paused" and not "no store".
describe("pausedStoresOf for a paused company", () => {
  const pauseCompany = (id: string) => db.update(companies).set({ suspendedAt: new Date(), suspendedReason: "db test", suspendedByName: "Test" }).where(eq(companies.id, id));

  it("lists a member's store of a paused company, by its own name, and not once the company is restored", async () => {
    const owner = await makeBareAccount("pc-owner");
    const { id } = await makeCompany("pc-member", owner);
    const { store } = await makeCompanyStore(id, null, "pc-store");
    const { userId } = await makePerson(store, null);
    expect(await pausedStoresOf(userId)).toEqual([]);
    await pauseCompany(id);
    expect((await pausedStoresOf(userId)).map((s) => s.id)).toEqual([store]);
    expect((await resolveAccess(userId, { activeStoreId: store })).activeStoreId).toBeNull();
    await db.update(companies).set({ suspendedAt: null, suspendedReason: null, suspendedByName: null }).where(eq(companies.id, id));
    expect(await pausedStoresOf(userId)).toEqual([]);
  });

  it("lists the company itself for its owner, a corporate admin and a regional manager, who hold no member row", async () => {
    const owner = await makeBareAccount("pc-o");
    const { id } = await makeCompany("pc-roles", owner);
    const admin = await makeBareAccount("pc-a");
    await assignCompanyRole(id, admin, "corporate_admin");
    await pauseCompany(id);
    for (const who of [owner, admin]) {
      expect((await resolveAccess(who, {})).company, who).toBeNull();
      expect(await pausedStoresOf(who), who).toEqual([{ id, name: "Test company pc-roles", kind: "company" }]);
    }
  });

  it("lists nothing for someone of another company, and a store both paused and of a paused company once", async () => {
    const owner = await makeBareAccount("pc-x");
    const { id } = await makeCompany("pc-once", owner);
    const { store } = await makeCompanyStore(id, null, "pc-once-store");
    const { userId } = await makePerson(store, null);
    await pause(store);
    await pauseCompany(id);
    expect((await pausedStoresOf(userId)).map((s) => s.id)).toEqual([store]);
    expect(await pausedStoresOf(await makeBareAccount("pc-other"))).toEqual([]);
  });
});
