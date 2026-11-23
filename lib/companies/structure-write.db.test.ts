// Regions and moving a store, against the dev database (spec 0.7.1 6.3, 15): every change logs its event in the
// same statement, a region in use cannot be deleted, and nothing reaches into another company.

import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companyEvents, companyInvitations, regions, storeProfiles } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";
import { dropPeople } from "@/lib/access/test-roles";

import type { CompanyActor } from "./events";
import { renameCompany } from "./rename";
import { addRegion, deleteRegion, moveStore, renameRegion } from "./structure-write";
import { assignCompanyRole, dropCompanies, makeAccount, makeCompany, makeCompanyStore, makeRegion } from "./test-companies";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const actor = (userId: string): CompanyActor => ({ userId, name: "Ana Owner" });
const events = async (companyId: string) => (await db.select({ event: companyEvents.event, detail: companyEvents.detail }).from(companyEvents).where(eq(companyEvents.companyId, companyId)).orderBy(asc(companyEvents.event), asc(companyEvents.createdAt), asc(companyEvents.id)));
const regionNames = async (companyId: string) => (await db.select({ name: regions.name }).from(regions).where(eq(regions.companyId, companyId))).map((r) => r.name).sort();

describe("regions", { timeout: 30_000 }, () => {
  it("adds one with its event, refuses a name taken in any case or empty, and keeps another company's names apart", async () => {
    const a = await makeCompany("rg-a");
    const b = await makeCompany("rg-b");
    expect((await addRegion(a.id, actor(a.ownerId), " North "))).toEqual({ status: "added" });
    expect(await addRegion(a.id, actor(a.ownerId), "north")).toEqual({ status: "taken" });
    expect(await addRegion(a.id, actor(a.ownerId), "   ")).toEqual({ status: "invalid" });
    expect(await addRegion(b.id, actor(b.ownerId), "North")).toEqual({ status: "added" });
    expect(await regionNames(a.id)).toEqual(["North"]);
    expect(await events(a.id)).toEqual([{ event: "region_added", detail: { name: "North" } }]);
  });

  it("renames pinned to the version seen: a rename made meanwhile is stale even if the name came back, a taken one is refused", async () => {
    const c = await makeCompany("rg-ren");
    const north = await makeRegion(c.id, "North");
    await makeRegion(c.id, "South");
    expect(await renameRegion(c.id, actor(c.ownerId), north, { name: "North", version: 1 }, "Northeast")).toEqual({ status: "renamed" });
    expect(await renameRegion(c.id, actor(c.ownerId), north, { name: "North", version: 1 }, "Elsewhere")).toEqual({ status: "stale" });
    expect(await renameRegion(c.id, actor(c.ownerId), north, { name: "Northeast", version: 2 }, "south")).toEqual({ status: "taken" });
    expect(await renameRegion(c.id, actor(c.ownerId), north, { name: "Northeast", version: 2 }, "Northeast")).toEqual({ status: "unchanged" });
    // Renamed away and back by someone else: the name the page saw is the name now, but the version moved on.
    expect(await renameRegion(c.id, actor(c.ownerId), north, { name: "Northeast", version: 2 }, "North")).toEqual({ status: "renamed" });
    expect(await renameRegion(c.id, actor(c.ownerId), north, { name: "North", version: 1 }, "Elsewhere")).toEqual({ status: "stale" });
    expect(await events(c.id)).toEqual([
      { event: "region_renamed", detail: { from: "North", to: "Northeast" } },
      { event: "region_renamed", detail: { from: "Northeast", to: "North" } },
    ]);
  });

  it("cannot be renamed or deleted through another company's id", async () => {
    const a = await makeCompany("rg-x-a");
    const b = await makeCompany("rg-x-b");
    const theirs = await makeRegion(b.id, "Theirs");
    expect(await renameRegion(a.id, actor(a.ownerId), theirs, { name: "Theirs", version: 1 }, "Mine")).toEqual({ status: "stale" });
    expect(await deleteRegion(a.id, actor(a.ownerId), theirs)).toEqual({ status: "gone" });
    expect(await regionNames(b.id)).toEqual(["Theirs"]);
  });

  it("is deleted only while empty: a store, a regional manager or a waiting invitation refuses it", async () => {
    const c = await makeCompany("rg-del");
    const used = await makeRegion(c.id, "Used");
    const managed = await makeRegion(c.id, "Managed");
    const empty = await makeRegion(c.id, "Empty");
    const store = await makeCompanyStore(c.id, used, "rg-del");
    const manager = await makeAccount("rg-del-mgr");
    await assignCompanyRole(c.id, manager, "regional_manager", managed);
    expect(await deleteRegion(c.id, actor(c.ownerId), used)).toEqual({ status: "used" });
    expect(await deleteRegion(c.id, actor(c.ownerId), managed)).toEqual({ status: "used" });
    expect(await regionNames(c.id)).toEqual(["Empty", "Managed", "Used"]);
    expect(await deleteRegion(c.id, actor(c.ownerId), empty)).toEqual({ status: "deleted" });
    expect(await deleteRegion(c.id, actor(c.ownerId), empty)).toEqual({ status: "gone" });
    expect(await events(c.id)).toEqual([{ event: "region_deleted", detail: { name: "Empty" } }]);

    // Once the store moves out, the region goes.
    expect(await moveStore(c.id, actor(c.ownerId), store.store, null)).toEqual({ status: "moved" });
    expect(await deleteRegion(c.id, actor(c.ownerId), used)).toEqual({ status: "deleted" });
  });

  it("is not blocked by a dead waiting invitation: an expired or lapsed one goes with the region, a live one still refuses", async () => {
    const c = await makeCompany("rg-dead");
    const stranger = await makeAccount("rg-dead-stranger");
    const invite = async (label: string, regionId: string, inviterId: string, expiresAt: Date) => {
      await db.insert(companyInvitations).values({ id: `rg-dead-${label}-${c.id}`, companyId: c.id, email: `${label}@example.test`, role: "regional_manager", regionId, inviterId, expiresAt });
    };
    const future = new Date(Date.now() + 3_600_000);
    const live = await makeRegion(c.id, "Live");
    const expired = await makeRegion(c.id, "Expired");
    const lapsed = await makeRegion(c.id, "Lapsed");
    await invite("live", live, c.ownerId, future);
    await invite("expired", expired, c.ownerId, new Date(Date.now() - 1000));
    await invite("lapsed", lapsed, stranger, future);
    expect(await deleteRegion(c.id, actor(c.ownerId), live)).toEqual({ status: "used" });
    expect(await deleteRegion(c.id, actor(c.ownerId), expired)).toEqual({ status: "deleted" });
    expect(await deleteRegion(c.id, actor(c.ownerId), lapsed)).toEqual({ status: "deleted" });
    expect(await regionNames(c.id)).toEqual(["Live"]);
    expect((await db.select({ id: companyInvitations.id }).from(companyInvitations).where(eq(companyInvitations.companyId, c.id))).map((r) => r.id)).toEqual([`rg-dead-live-${c.id}`]);
  });
});

describe("moving a store", { timeout: 30_000 }, () => {
  it("moves it to a region of its own company, or to none, and logs the names", async () => {
    const c = await makeCompany("mv");
    const north = await makeRegion(c.id, "North");
    const store = await makeCompanyStore(c.id, null, "mv");
    expect(await moveStore(c.id, actor(c.ownerId), store.store, north)).toEqual({ status: "moved" });
    expect(await moveStore(c.id, actor(c.ownerId), store.store, north)).toEqual({ status: "unchanged" });
    expect((await db.select().from(storeProfiles).where(eq(storeProfiles.storeId, store.store)))[0].regionId).toBe(north);
    expect(await moveStore(c.id, actor(c.ownerId), store.store, null)).toEqual({ status: "moved" });
    const logged = (await db.select({ detail: companyEvents.detail }).from(companyEvents).where(and(eq(companyEvents.companyId, c.id), eq(companyEvents.event, "store_moved")))).map((e) => e.detail);
    expect(logged).toContainEqual({ store: expect.any(String), from: null, to: "North" });
    expect(logged).toContainEqual({ store: expect.any(String), from: "North", to: null });
  });

  it("refuses another company's region and another company's store", async () => {
    const a = await makeCompany("mv-a");
    const b = await makeCompany("mv-b");
    const theirRegion = await makeRegion(b.id, "Theirs");
    const mine = await makeCompanyStore(a.id, null, "mv-mine");
    const theirs = await makeCompanyStore(b.id, null, "mv-theirs");
    expect(await moveStore(a.id, actor(a.ownerId), mine.store, theirRegion)).toEqual({ status: "gone" });
    expect(await moveStore(a.id, actor(a.ownerId), theirs.store, null)).toEqual({ status: "gone" });
    expect((await db.select().from(storeProfiles).where(eq(storeProfiles.storeId, mine.store)))[0].regionId).toBeNull();
  });

  it("answers gone for a region deleted before the move, and leaves the store where it was", async () => {
    const c = await makeCompany("mv-gone");
    const doomed = await makeRegion(c.id, "Doomed");
    const store = await makeCompanyStore(c.id, null, "mv-gone");
    expect(await deleteRegion(c.id, actor(c.ownerId), doomed)).toEqual({ status: "deleted" });
    expect(await moveStore(c.id, actor(c.ownerId), store.store, doomed)).toEqual({ status: "gone" });
    expect((await db.select().from(storeProfiles).where(eq(storeProfiles.storeId, store.store)))[0].regionId).toBeNull();
  });
});

describe("renaming the company", { timeout: 30_000 }, () => {
  it("renames pinned to the name seen and logs it", async () => {
    const c = await makeCompany("cn");
    const seen = "Test company cn";
    expect((await renameCompany(c.id, actor(c.ownerId), seen, "A")).status).toBe("invalid");
    expect((await renameCompany(c.id, actor(c.ownerId), seen, "Acme East")).status).toBe("renamed");
    expect((await renameCompany(c.id, actor(c.ownerId), seen, "Other")).status).toBe("stale");
    expect((await renameCompany(c.id, actor(c.ownerId), "Acme East", "Acme East")).status).toBe("unchanged");
    expect((await events(c.id)).map((e) => e.event)).toEqual(["company_renamed"]);
  });
});
