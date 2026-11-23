// Changing and removing company people against the dev database (spec 0.7.1 6.5): the rank rule, the version and
// role pins, the actor's authority re-checked in the statement, and a region change moving what a regional
// manager reaches on the next resolveAccess.

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companyEvents, roleAssignments } from "@/db/schema";
import { resolveAccess } from "@/lib/access/resolve";
import { dropPeople } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import type { CompanyInviter } from "./invite";
import { changeRegion, removeCompanyPerson } from "./people-write";
import { dropCompanies, makeBareAccount, makeCompanyStore, makeStaffedCompany } from "./test-companies";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const as = (userId: string, role: CompanyInviter["role"]): CompanyInviter => ({ userId, name: `Test ${role}`, role });
const assignment = async (userId: string) => (await db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId)))[0];
const events = (companyId: string, event: string) => db.select().from(companyEvents).where(and(eq(companyEvents.companyId, companyId), eq(companyEvents.event, event)));

describe("changeRegion", { timeout: 30_000 }, () => {
  it("moves a regional manager, bumps the version, logs it, and moves which stores they reach", async () => {
    const s = await makeStaffedCompany("cr-ok");
    const northStore = await makeCompanyStore(s.company.id, s.north, "cr-north");
    const southStore = await makeCompanyStore(s.company.id, s.south, "cr-south");
    expect((await resolveAccess(s.manager, {})).stores.map((x) => x.id)).toEqual([northStore.store]);
    const before = await assignment(s.manager);
    expect(await changeRegion(s.company.id, as(s.admin, "corporate_admin"), s.manager, before.version, s.south)).toMatchObject({ status: "changed" });
    expect((await assignment(s.manager)).version).toBe(before.version + 1);
    expect((await resolveAccess(s.manager, {})).stores.map((x) => x.id)).toEqual([southStore.store]);
    expect((await events(s.company.id, "company_region_changed"))[0].detail).toMatchObject({ from: "North", to: "South" });
  });

  it("is stale when the assignment changed since the page, and refuses the same region and a region of another company", async () => {
    const s = await makeStaffedCompany("cr-stale");
    const other = await makeStaffedCompany("cr-stale-other");
    const before = await assignment(s.manager);
    const owner = as(s.owner, "owner");
    expect(await changeRegion(s.company.id, owner, s.manager, before.version, s.north)).toEqual({ status: "unchanged" });
    expect(await changeRegion(s.company.id, owner, s.manager, before.version, other.south)).toEqual({ status: "stale" });
    expect(await changeRegion(s.company.id, owner, s.manager, before.version + 5, s.south)).toEqual({ status: "stale" });
    expect((await assignment(s.manager)).regionId).toBe(s.north);
  });

  it("is for regional managers, from someone above them, never yourself", async () => {
    const s = await makeStaffedCompany("cr-rank");
    expect(await changeRegion(s.company.id, as(s.owner, "owner"), s.admin, 0, s.south)).toEqual({ status: "invalid" });
    const other = await makeBareAccount("cr-rm2");
    await db.insert(roleAssignments).values({ userId: other, companyId: s.company.id, role: "regional_manager", regionId: s.north });
    expect(await changeRegion(s.company.id, as(s.manager, "regional_manager"), other, 0, s.south)).toEqual({ status: "forbidden" });
    expect(await changeRegion(s.company.id, as(s.manager, "regional_manager"), s.manager, 0, s.south)).toEqual({ status: "forbidden" });
    // A corporate admin cannot move the owner or another admin (neither is a regional manager they outrank).
    expect(await changeRegion(s.company.id, as(s.admin, "corporate_admin"), s.admin, 0, s.south)).toEqual({ status: "forbidden" });
  });

  it("re-checks the actor in the statement: a demoted corporate admin changes nothing", async () => {
    const s = await makeStaffedCompany("cr-demoted");
    const before = await assignment(s.manager);
    await db.delete(roleAssignments).where(eq(roleAssignments.userId, s.admin));
    expect(await changeRegion(s.company.id, as(s.admin, "corporate_admin"), s.manager, before.version, s.south)).toEqual({ status: "stale" });
    expect((await assignment(s.manager)).regionId).toBe(s.north);
  });
});

describe("removeCompanyPerson", { timeout: 30_000 }, () => {
  it("removes a role, logs it and keeps the person's store membership; the stores go on the next call", async () => {
    const s = await makeStaffedCompany("rm-ok");
    const store = await makeCompanyStore(s.company.id, s.north, "rm-ok-store");
    expect((await resolveAccess(s.manager, {})).stores).toHaveLength(1);
    const { version } = await assignment(s.manager);
    expect(await removeCompanyPerson(s.company.id, as(s.admin, "corporate_admin"), s.manager, version)).toMatchObject({ status: "removed" });
    expect(await assignment(s.manager)).toBeUndefined();
    expect((await resolveAccess(s.manager, {})).stores).toEqual([]);
    expect((await events(s.company.id, "company_role_removed"))[0].detail).toMatchObject({ role: "Regional Manager", region: "North" });
    expect(store.store).toBeTruthy();
  });

  it("applies the rank rule: the owner removes anyone, a corporate admin only regional managers, nobody themselves", async () => {
    const s = await makeStaffedCompany("rm-rank");
    const admin = await assignment(s.admin);
    expect(await removeCompanyPerson(s.company.id, as(s.admin, "corporate_admin"), s.admin, admin.version)).toEqual({ status: "forbidden" });
    const second = await makeBareAccount("rm-rank-admin2");
    await db.insert(roleAssignments).values({ userId: second, companyId: s.company.id, role: "corporate_admin" });
    expect(await removeCompanyPerson(s.company.id, as(s.admin, "corporate_admin"), second, 0)).toEqual({ status: "forbidden" });
    expect(await removeCompanyPerson(s.company.id, as(s.manager, "regional_manager"), s.admin, admin.version)).toEqual({ status: "forbidden" });
    expect((await removeCompanyPerson(s.company.id, as(s.owner, "owner"), second, (await assignment(second)).version)).status).toBe("removed");
    expect(await removeCompanyPerson(s.company.id, as(s.owner, "owner"), s.owner, 0)).toEqual({ status: "gone" });
  });

  it("is stale for an old version or a role changed since, gone for someone already removed, and never reaches another company", async () => {
    const s = await makeStaffedCompany("rm-stale");
    const other = await makeStaffedCompany("rm-stale-other");
    const owner = as(s.owner, "owner");
    const { version } = await assignment(s.manager);
    expect(await removeCompanyPerson(s.company.id, owner, s.manager, version + 1)).toEqual({ status: "stale" });
    expect(await removeCompanyPerson(s.company.id, owner, other.manager, version)).toEqual({ status: "gone" });
    expect(await assignment(other.manager)).toBeDefined();
    expect((await removeCompanyPerson(s.company.id, owner, s.manager, version)).status).toBe("removed");
    expect(await removeCompanyPerson(s.company.id, owner, s.manager, version)).toEqual({ status: "gone" });
  });

  it("re-checks the actor in the statement: a corporate admin who claims to be the owner removes no one", async () => {
    const s = await makeStaffedCompany("rm-claim");
    const second = await makeBareAccount("rm-claim-admin2");
    await db.insert(roleAssignments).values({ userId: second, companyId: s.company.id, role: "corporate_admin" });
    expect(await removeCompanyPerson(s.company.id, as(s.admin, "owner"), second, 0)).toEqual({ status: "stale" });
    expect(await assignment(second)).toBeDefined();
  });
});
