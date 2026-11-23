// The Store panel in a company store (spec 0.7.1 6.6): the region's regional managers at the top of People
// (names for everyone, emails only with people.manage), "No Store Manager yet." when nobody holds it, and a
// company person's rows and invite roles by rank. The viewer is built through resolveAccess, as getCurrentMember does.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { dropCompanies, emailOf, makeCompanyStore, makeStaffedCompany } from "@/lib/companies/test-companies";
import type { Member } from "@/lib/current-member";
import { dropStores } from "@/lib/products/test-stores";

import { peopleViewFor } from "./people";
import { resolveAccess } from "./resolve";
import { dropPeople, makePerson, makeStoreWithRoles, type StoreRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

/** The member as getCurrentMember builds it for this store: the real resolveAccess, with the viewer's name. */
async function memberOf(userId: string, store: string): Promise<Member> {
  const access = await resolveAccess(userId, { activeStoreId: store });
  const [u] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId));
  return { kind: "member", user: { id: userId, name: u.name, email: u.email }, stores: [], activeStoreId: store, role: access.role, switches: [...access.switches], company: access.company, isPlatformAdmin: false, helpReplies: 0 };
}

/** A person in the store with a name the assertions can read. */
async function personNamed(store: string, roles: StoreRoles, key: "store_manager" | "sales_associate", name: string): Promise<string> {
  const { userId } = await makePerson(store, roles[key]);
  await db.update(user).set({ name }).where(eq(user.id, userId));
  return userId;
}

describe("the Store panel in a company store", () => {
  it("lists the region's regional managers, emails only with people.manage, and nobody from another region", async () => {
    const co = await makeStaffedCompany("panel-rm");
    await db.update(user).set({ name: "Rhea North" }).where(eq(user.id, co.manager));
    const north = await makeCompanyStore(co.company.id, co.north, "panel-north");
    const samId = await personNamed(north.store, north.roles, "store_manager", "Sam Manager");
    const zoeId = await personNamed(north.store, north.roles, "sales_associate", "Zoe Sales");
    const south = await makeCompanyStore(co.company.id, co.south, "panel-south");
    const oscarId = await personNamed(south.store, south.roles, "sales_associate", "Oscar South");

    const forZoe = await peopleViewFor(await memberOf(zoeId, north.store));
    expect(forZoe.regionalManagers).toEqual([{ name: "Rhea North", email: null, isYou: false }]);
    expect(forZoe.canManage).toBe(false);

    const forSam = await peopleViewFor(await memberOf(samId, north.store));
    expect(forSam.regionalManagers).toEqual([{ name: "Rhea North", email: await emailOf(co.manager), isYou: false }]);

    const forOscar = await peopleViewFor(await memberOf(oscarId, south.store));
    expect(forOscar.regionalManagers).toEqual([]);
  });

  it("says there is no Store Manager when nobody holds it, and a standalone store has no regional managers", async () => {
    const co = await makeStaffedCompany("panel-empty");
    const empty = await makeCompanyStore(co.company.id, co.north, "panel-empty-store");
    const owner = await peopleViewFor(await memberOf(co.owner, empty.store));
    expect(owner.hasStoreManager).toBe(false);
    expect(owner.regionalManagers.map((m) => m.name)).toEqual(["Test panel-empty-rm"]);

    const alone = await makeStoreWithRoles("panel-standalone");
    const aloneId = await makePerson(alone.store, alone.roles.sales_associate);
    const view = await peopleViewFor(await memberOf(aloneId.userId, alone.store));
    expect(view.regionalManagers).toEqual([]);
  });

  it("gives an owner, a corporate admin and a regional manager the store's rows and every store role by rank", async () => {
    const co = await makeStaffedCompany("panel-tools");
    const store = await makeCompanyStore(co.company.id, co.north, "panel-tools-store");
    await personNamed(store.store, store.roles, "store_manager", "Sam Manager");
    await personNamed(store.store, store.roles, "sales_associate", "Zoe Sales");

    const owner = await peopleViewFor(await memberOf(co.owner, store.store));
    expect(owner.canManage).toBe(true);
    expect(owner.groups.flatMap((g) => g.people).filter((p) => p.canAct).map((p) => p.name)).toEqual(["Sam Manager", "Zoe Sales"]);
    expect(owner.assignable).toHaveLength(5);
    expect(owner.hasStoreManager).toBe(true);

    const admin = await peopleViewFor(await memberOf(co.admin, store.store));
    expect(admin.assignable).toHaveLength(5);
    expect(admin.groups.flatMap((g) => g.people).every((p) => p.canAct)).toBe(true);

    const rm = await peopleViewFor(await memberOf(co.manager, store.store));
    expect(rm.canManage).toBe(true);
    expect(rm.groups.flatMap((g) => g.people).find((p) => p.name === "Zoe Sales")?.canAct).toBe(true);
    expect(rm.assignable).toHaveLength(5);
  });
});
