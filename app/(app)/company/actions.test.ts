// /company's writes with the real guards and resolveAccess against the dev database; only Better Auth's session
// is stood in for. Who may write is decided by the person's real company role: an owner and a corporate admin
// hold the company switches, a regional manager and a store member hold none, and nobody reaches another company.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));

import { db } from "@/db";
import { companies, companyEvents, regions, storeProfiles } from "@/db/schema";
import { dropPeople, makePerson } from "@/lib/access/test-roles";
import { assignCompanyRole, dropCompanies, makeAccount, makeBareAccount, makeCompany, makeCompanyStore, makeRegion } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";

import { addRegionAction, deleteRegionAction, moveStoreAction, renameCompanyAction, renameRegionAction } from "./actions";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

beforeEach(() => vi.clearAllMocks());

const signedInAs = (userId: string) => mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Test person", email: `${userId}@example.com` }, session: { id: "s", activeStoreId: null, activeOrganizationId: null } });
const regionsOf = async (companyId: string) => (await db.select({ name: regions.name }).from(regions).where(eq(regions.companyId, companyId))).map((r) => r.name).sort();
const nameOf = async (companyId: string) => (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)))[0].name;

async function acme(label: string) {
  const company = await makeCompany(label, await makeBareAccount(`${label}-owner`));
  const north = await makeRegion(company.id, "North");
  const store = await makeCompanyStore(company.id, north, label);
  return { company, north, store };
}

describe("a corporate admin", { timeout: 30_000 }, () => {
  it("renames the company, adds, renames and deletes regions and moves a store, each logged", async () => {
    const { company, north, store } = await acme("act-adm");
    const admin = await makeBareAccount("act-adm-admin");
    await assignCompanyRole(company.id, admin, "corporate_admin");
    signedInAs(admin);
    expect(await renameCompanyAction("Acme West", await nameOf(company.id))).toMatchObject({ status: "saved" });
    expect(await addRegionAction("South")).toMatchObject({ status: "saved" });
    expect(await renameRegionAction(north, "Northeast", "North")).toMatchObject({ status: "saved" });
    expect(await moveStoreAction(store.store, null)).toMatchObject({ status: "saved" });
    expect(await deleteRegionAction(north)).toMatchObject({ status: "saved" });
    expect(await nameOf(company.id)).toBe("Acme West");
    expect(await regionsOf(company.id)).toEqual(["South"]);
    const logged = (await db.select({ event: companyEvents.event }).from(companyEvents).where(eq(companyEvents.companyId, company.id))).map((e) => e.event).sort();
    expect(logged).toEqual(["company_renamed", "region_added", "region_deleted", "region_renamed", "store_moved"]);
  });

  it("is told to move a region's stores first, and nothing is deleted", async () => {
    const { company, north } = await acme("act-used");
    const admin = await makeBareAccount("act-used-admin");
    await assignCompanyRole(company.id, admin, "corporate_admin");
    signedInAs(admin);
    expect(await deleteRegionAction(north)).toEqual({ status: "refused", message: "Move this region's stores and regional managers first." });
    expect(await regionsOf(company.id)).toEqual(["North"]);
  });

  it("cannot touch another company: its region or its store", async () => {
    const mine = await acme("act-own");
    const theirs = await acme("act-other");
    const admin = await makeBareAccount("act-own-admin");
    await assignCompanyRole(mine.company.id, admin, "corporate_admin");
    signedInAs(admin);
    expect((await renameRegionAction(theirs.north, "Mine", "North")).status).toBe("refused");
    expect((await deleteRegionAction(theirs.north)).status).toBe("refused");
    expect((await moveStoreAction(theirs.store.store, null)).status).toBe("refused");
    expect(await regionsOf(theirs.company.id)).toEqual(["North"]);
    expect((await db.select({ region: storeProfiles.regionId }).from(storeProfiles).where(eq(storeProfiles.storeId, theirs.store.store)))[0].region).toBe(theirs.north);
  });
});

describe("a person without the switch", { timeout: 30_000 }, () => {
  it("a regional manager holds no company switch: every write is refused and nothing changes", async () => {
    const { company, north, store } = await acme("act-rm");
    const manager = await makeBareAccount("act-rm-mgr");
    await assignCompanyRole(company.id, manager, "regional_manager", north);
    signedInAs(manager);
    const refused = { status: "refused" };
    expect(await renameCompanyAction("Hijacked", await nameOf(company.id))).toMatchObject(refused);
    expect(await addRegionAction("South")).toMatchObject(refused);
    expect(await renameRegionAction(north, "Elsewhere", "North")).toMatchObject(refused);
    expect(await moveStoreAction(store.store, null)).toMatchObject(refused);
    expect(await deleteRegionAction(north)).toMatchObject(refused);
    expect(await nameOf(company.id)).toBe("Test company act-rm");
    expect(await regionsOf(company.id)).toEqual(["North"]);
  });

  it("a store member with no company role is sent to /no-access and writes nothing", async () => {
    const { company } = await acme("act-staff");
    const sales = await makeCompanyStore(company.id, null, "act-staff-2");
    const person = await makePerson(sales.store, sales.roles.sales_associate);
    signedInAs(person.userId);
    await expect(addRegionAction("Sneaky")).rejects.toThrow("redirect:/no-access");
    expect(await regionsOf(company.id)).not.toContain("Sneaky");
  });

  it("a member of some other store, in no company, is sent to /no-access", async () => {
    const stranger = await makeAccount("act-stranger");
    signedInAs(stranger);
    await expect(addRegionAction("Nope")).rejects.toThrow("redirect:/no-access");
  });
});
