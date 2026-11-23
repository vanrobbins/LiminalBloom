// Which store a request works in, and what never resolves (spec 0.7.1, 4.2 and 4.3), against the dev database:
// the session's pointer, sessions from before 0021, stale values, paused stores and paused companies.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, organization, user } from "@/db/auth-schema";
import { companies, storeSuspensions } from "@/db/schema";
import { assignCompanyRole, dropCompanies, makeBareAccount, makeCompany, makeCompanyStore, makeRegion } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";

import { resolveAccess } from "./resolve";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

/** A person in two standalone stores: `first` joined a day ago, `second` just now. */
async function inTwo(label: string) {
  const [first, second] = [await makeStoreWithRoles(`${label}-1`), await makeStoreWithRoles(`${label}-2`)];
  const { userId } = await makePerson(first.store, first.roles.sales_associate);
  await db.insert(member).values({ id: crypto.randomUUID(), organizationId: second.store, userId, role: "member", roleId: second.roles.sales_associate, createdAt: new Date(Date.now() + 60_000) });
  return { userId, first: first.store, second: second.store };
}

describe("the session's pointers", { timeout: 30_000 }, () => {
  it("works in the store the session names while the person reaches it", async () => {
    const { userId, second } = await inTwo("ptr");
    expect((await resolveAccess(userId, { activeStoreId: second })).activeStoreId).toBe(second);
  });

  it("falls back for a stale activeStoreId: a store they left, one that is not theirs, or one that is gone", async () => {
    const { userId, first, second } = await inTwo("stale");
    const stranger = await makeStoreWithRoles("stale-stranger");
    await db.delete(member).where(eq(member.organizationId, second));
    for (const stale of [second, stranger.store, "no-such-store"]) expect((await resolveAccess(userId, { activeStoreId: stale })).activeStoreId, stale).toBe(first);
  });

  it("falls back to the remembered store, then the store joined first, when the session names none", async () => {
    const { userId, first, second } = await inTwo("none");
    expect((await resolveAccess(userId, {})).activeStoreId).toBe(first);
    await db.update(user).set({ lastActiveStoreId: second }).where(eq(user.id, userId));
    expect((await resolveAccess(userId, { activeStoreId: null })).activeStoreId).toBe(second);
  });

  it("serves a session from before 0021, which has only activeOrganizationId", async () => {
    const { userId, first, second } = await inTwo("old");
    expect((await resolveAccess(userId, { activeOrganizationId: second })).activeStoreId).toBe(second);
    // The new pointer wins over the old one; a stale old one is skipped.
    expect((await resolveAccess(userId, { activeStoreId: first, activeOrganizationId: second })).activeStoreId).toBe(first);
    expect((await resolveAccess(userId, { activeOrganizationId: "no-such-store" })).activeStoreId).toBe(first);
  });

  it("opens a company person with no membership in the company's first store by name", async () => {
    const owner = await makeBareAccount("first-by-name");
    const { id } = await makeCompany("byname", owner);
    const [z, a] = [await makeCompanyStore(id, null, "byname-z"), await makeCompanyStore(id, null, "byname-a")];
    await db.update(organization).set({ name: "Zulu" }).where(eq(organization.id, z.store));
    await db.update(organization).set({ name: "Alpha" }).where(eq(organization.id, a.store));
    expect((await resolveAccess(owner, {})).activeStoreId).toBe(a.store);
  });
});

describe("a paused store or company never resolves", { timeout: 30_000 }, () => {
  it("drops a paused store for a company person, and for a member, and brings it back when restored", async () => {
    const owner = await makeBareAccount("pause-owner");
    const { id } = await makeCompany("pause", owner);
    const [one, two] = [await makeCompanyStore(id, null, "pause-1"), await makeCompanyStore(id, null, "pause-2")];
    const worker = await makePerson(one.store, one.roles.sales_associate);
    await db.insert(storeSuspensions).values({ storeId: one.store, reason: "db test", suspendedByName: "Test" });
    expect((await resolveAccess(owner, { activeStoreId: one.store })).stores.map((s) => s.id)).toEqual([two.store]);
    expect(await resolveAccess(worker.userId, { activeStoreId: one.store })).toMatchObject({ activeStoreId: null, stores: [] });
    await db.delete(storeSuspensions).where(eq(storeSuspensions.storeId, one.store));
    expect((await resolveAccess(owner, { activeStoreId: one.store })).stores).toHaveLength(2);
    expect((await resolveAccess(worker.userId, {})).activeStoreId).toBe(one.store);
  });

  it("drops every store of a paused company for its owner, corporate admin, regional manager and members, and the company role itself", async () => {
    const owner = await makeBareAccount("co-pause-owner");
    const { id } = await makeCompany("co-pause", owner);
    const region = await makeRegion(id, "North");
    const store = await makeCompanyStore(id, region, "co-pause-s");
    const [admin, manager] = [await makeBareAccount("co-pause-admin"), await makeBareAccount("co-pause-rm")];
    await assignCompanyRole(id, admin, "corporate_admin");
    await assignCompanyRole(id, manager, "regional_manager", region);
    const worker = await makePerson(store.store, store.roles.vm_worker);
    for (const who of [owner, admin, manager, worker.userId]) expect((await resolveAccess(who, {})).stores, who).toHaveLength(1);

    await db.update(companies).set({ suspendedAt: new Date(), suspendedReason: "db test", suspendedByName: "Test" }).where(eq(companies.id, id));
    for (const who of [owner, admin, manager, worker.userId]) {
      expect(await resolveAccess(who, { activeStoreId: store.store }), who).toMatchObject({ activeStoreId: null, role: null, stores: [], company: null });
    }

    await db.update(companies).set({ suspendedAt: null, suspendedReason: null, suspendedByName: null }).where(eq(companies.id, id));
    for (const who of [owner, admin, manager, worker.userId]) expect((await resolveAccess(who, {})).activeStoreId, who).toBe(store.store);
  });

  it("leaves a member's standalone store alone when their company is paused", async () => {
    const owner = await makeBareAccount("keep-owner");
    const { id } = await makeCompany("keep", owner);
    await makeCompanyStore(id, null, "keep-s");
    const mine = await makeStoreWithRoles("keep-mine");
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: mine.store, userId: owner, role: "member", roleId: mine.roles.vm_manager, createdAt: new Date() });
    await db.update(companies).set({ suspendedAt: new Date() }).where(eq(companies.id, id));
    expect(await resolveAccess(owner, {})).toMatchObject({ activeStoreId: mine.store, company: null });
  });
});
