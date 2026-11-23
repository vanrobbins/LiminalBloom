// resolveAccess for company people, against the dev database (spec 0.7.1, 4.1, 4.2 and 15): who reaches which
// store, with which switches, and that company A never reaches company B or a standalone store.

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleAssignments, storeProfiles } from "@/db/schema";
import { assignCompanyRole, dropCompanies, makeBareAccount, makeCompany, makeCompanyStore, makeRegion } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";

import { companyRole } from "./company-roles";
import { resolveAccess } from "./resolve";
import { SWITCHES } from "./switches";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const sorted = (s: Iterable<string>) => [...s].sort();
const ids = (a: { stores: { id: string }[] }) => a.stores.map((s) => s.id).sort();
const asked = (userId: string, store: string | null = null) => resolveAccess(userId, { activeStoreId: store });

/** A company with a North and a South region, a store in each and one with no region. */
async function acme(label: string, owner?: string) {
  const company = await makeCompany(label, owner);
  const [north, south] = [await makeRegion(company.id, "North"), await makeRegion(company.id, "South")];
  const stores = { north: await makeCompanyStore(company.id, north, `${label}-n`), south: await makeCompanyStore(company.id, south, `${label}-s`), none: await makeCompanyStore(company.id, null, `${label}-0`) };
  return { company, regions: { north, south }, stores };
}

describe("an owner", { timeout: 30_000 }, () => {
  it("reaches every store of the company with every switch, as the synthetic Owner, and holds the company switches", async () => {
    const bare = await makeBareAccount("owner");
    const { company, stores } = await acme("own", bare);
    const access = await asked(bare, stores.south.store);
    expect(ids(access)).toEqual(sorted([stores.north.store, stores.south.store, stores.none.store]));
    expect(access.activeStoreId).toBe(stores.south.store);
    expect(access.role).toEqual({ id: "company:owner", name: "Owner", rank: 10, builtin: null });
    expect(sorted(access.switches)).toEqual(sorted(SWITCHES));
    expect(access.company).toEqual({ id: company.id, name: expect.any(String), role: "owner", regionId: null, regionName: null, switches: ["company.settings", "company.structure", "company.people"] });
    expect(access.stores.find((s) => s.id === stores.north.store)).toMatchObject({ companyId: company.id, regionName: "North" });
  });

  it("has a company and no store while the company has none yet", async () => {
    const owner = await makeBareAccount("empty-owner");
    const { id } = await makeCompany("empty", owner);
    const access = await asked(owner);
    expect(access).toMatchObject({ activeStoreId: null, role: null, stores: [], company: { id, role: "owner" } });
  });
});

describe("a corporate admin", { timeout: 30_000 }, () => {
  it("reaches every store of the company with every switch and the company switches, and is no owner", async () => {
    const { company, stores } = await acme("adm");
    const admin = await makeBareAccount("admin");
    await assignCompanyRole(company.id, admin, "corporate_admin");
    const access = await asked(admin);
    expect(ids(access)).toEqual(sorted([stores.north.store, stores.south.store, stores.none.store]));
    expect(access.role?.id).toBe("company:corporate_admin");
    expect(sorted(access.switches)).toEqual(sorted(SWITCHES));
    expect(access.company?.role).toBe("corporate_admin");
  });

  it("loses the stores on the very next call once the assignment is removed", async () => {
    const { company, stores } = await acme("gone");
    const admin = await makeBareAccount("gone-admin");
    await assignCompanyRole(company.id, admin, "corporate_admin");
    expect((await asked(admin, stores.north.store)).activeStoreId).toBe(stores.north.store);
    await db.delete(roleAssignments).where(eq(roleAssignments.userId, admin));
    expect(await asked(admin, stores.north.store)).toMatchObject({ activeStoreId: null, stores: [], company: null, role: null });
  });
});

describe("a regional manager", { timeout: 30_000 }, () => {
  it("reaches only the stores of their region, with view and people.manage and no company switch", async () => {
    const { company, regions, stores } = await acme("rm");
    const manager = await makeBareAccount("rm");
    await assignCompanyRole(company.id, manager, "regional_manager", regions.north);
    const access = await asked(manager, stores.south.store);
    expect(ids(access)).toEqual([stores.north.store]);
    // A pointer at another region's store is not honoured.
    expect(access.activeStoreId).toBe(stores.north.store);
    expect(access.role?.id).toBe("company:regional_manager");
    expect(sorted(access.switches)).toEqual(sorted(companyRole("regional_manager").storeSwitches));
    expect(sorted(access.switches)).toEqual(["people.manage", "view"]);
    expect(access.company).toMatchObject({ role: "regional_manager", regionId: regions.north, regionName: "North", switches: [] });
  });

  it("follows a store moved to another region on the very next call, and reaches nothing in an empty region", async () => {
    const { company, regions, stores } = await acme("rm-move");
    const manager = await makeBareAccount("rm-move");
    await assignCompanyRole(company.id, manager, "regional_manager", regions.south);
    expect(ids(await asked(manager))).toEqual([stores.south.store]);
    await db.update(storeProfiles).set({ regionId: regions.north }).where(eq(storeProfiles.storeId, stores.south.store));
    expect(await asked(manager)).toMatchObject({ activeStoreId: null, stores: [], company: { regionName: "South" } });
  });
});

describe("a store member", { timeout: 30_000 }, () => {
  it("keeps their own role in a company store, with no company and the store's company and region names", async () => {
    const { company, stores } = await acme("mem");
    const { userId } = await makePerson(stores.north.store, stores.north.roles.vm_worker);
    const access = await asked(userId, stores.north.store);
    expect(access.role?.builtin).toBe("vm_worker");
    expect(access.company).toBeNull();
    expect(access.stores).toEqual([{ id: stores.north.store, name: expect.any(String), companyId: company.id, companyName: expect.any(String), regionId: expect.any(String), regionName: "North" }]);
  });

  it("unions the member role with a regional manager's, showing the higher rank", async () => {
    const { company, regions, stores } = await acme("union");
    const { userId } = await makePerson(stores.north.store, stores.north.roles.sales_associate);
    await assignCompanyRole(company.id, userId, "regional_manager", regions.north);
    const access = await asked(userId, stores.north.store);
    expect(access.role?.id).toBe("company:regional_manager");
    expect(sorted(access.switches)).toEqual(["people.manage", "products.stock", "view"]);
    // In their own other store the company gives nothing.
    const other = await makeStoreWithRoles("union-other");
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: other.store, userId, role: "member", roleId: other.roles.vm_manager, createdAt: new Date(Date.now() + 1000) });
    const there = await asked(userId, other.store);
    expect(there.role?.builtin).toBe("vm_manager");
    expect(there.switches.has("roles.manage")).toBe(false);
    expect(await db.select().from(member).where(and(eq(member.userId, userId), eq(member.organizationId, stores.south.store)))).toHaveLength(0);
  });
});

describe("company A against company B and standalone", { timeout: 30_000 }, () => {
  it("gives company A's people no store of company B and no standalone store, and the reverse", async () => {
    const [ownerA, adminB, rmA] = [await makeBareAccount("oA"), await makeBareAccount("aB"), await makeBareAccount("rA")];
    const a = await acme("A", ownerA);
    const b = await acme("B");
    const standalone = await makeStoreWithRoles("standalone");
    await assignCompanyRole(b.company.id, adminB, "corporate_admin");
    await assignCompanyRole(a.company.id, rmA, "regional_manager", a.regions.south);

    const bStores = Object.values(b.stores).map((s) => s.store);
    const aStores = Object.values(a.stores).map((s) => s.store);
    expect(ids(await asked(ownerA, b.stores.north.store))).toEqual(sorted(aStores));
    expect(ids(await asked(adminB, a.stores.north.store))).toEqual(sorted(bStores));
    expect(ids(await asked(rmA, standalone.store))).toEqual([a.stores.south.store]);
    // Naming another company's store as the active one is not honoured.
    expect((await asked(ownerA, b.stores.north.store)).activeStoreId).not.toBe(b.stores.north.store);
    expect((await asked(ownerA, standalone.store)).stores.map((s) => s.id)).not.toContain(standalone.store);
  });
});

describe("two-factor for company roles (DECISIONS 11-23)", { timeout: 30_000 }, () => {
  it("is required of an owner, a corporate admin and a regional manager, with a store or none, and not of a person with no company role", async () => {
    const [owner, admin, rm] = [await makeBareAccount("tfo"), await makeBareAccount("tfa"), await makeBareAccount("tfr")];
    const { company, regions, stores } = await acme("tf", owner);
    await assignCompanyRole(company.id, admin, "corporate_admin");
    await assignCompanyRole(company.id, rm, "regional_manager", regions.north);
    for (const who of [owner, admin, rm]) expect((await asked(who, stores.north.store)).requiresTwoFactor, who).toBe(true);
    const emptyOwner = await makeBareAccount("tfe");
    await makeCompany("tf-empty", emptyOwner);
    expect(await asked(emptyOwner)).toMatchObject({ activeStoreId: null, requiresTwoFactor: true });
    const worker = await makePerson(stores.north.store, stores.north.roles.vm_worker);
    expect((await asked(worker.userId, stores.north.store)).requiresTwoFactor).toBe(false);
  });
});
