// Migration 0021's deletes and its audit log: what a region delete does to each table that names it,
// what a store or company delete takes with it, company_events being insert-only, and the link from a
// help thread to a company request. Postgres is the thing under test, so nothing here is mocked.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization, user } from "@/db/auth-schema";
import { companies, companyEvents, companyRequests, helpRequests, regions, roleAssignments, storeProfiles } from "@/db/schema";
import { dropPeople } from "@/lib/access/test-roles";
import { dropCompanies, makeAccount, makeCompany, makeRegion } from "@/lib/companies/test-companies";
import { dbRefusal } from "@/lib/db/test-errors";
import { dropStores, makeStore } from "@/lib/products/test-stores";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const profileOf = async (storeId: string) => (await db.select().from(storeProfiles).where(eq(storeProfiles.storeId, storeId)))[0];

describe("deleting a region", () => {
  it("is refused while a regional manager holds it", async () => {
    const co = await makeCompany("cs-mgr");
    const region = await makeRegion(co.id, "West");
    await db.insert(roleAssignments).values({ userId: await makeAccount("cs-mgr-person"), companyId: co.id, role: "regional_manager", regionId: region });
    expect(await dbRefusal(db.delete(regions).where(eq(regions.id, region)))).toMatch(/violates foreign key constraint "role_assignments_region_fk"/);
  });

  it("clears only region_id on the stores in it: the store stays in the company", async () => {
    const co = await makeCompany("cs-null");
    const region = await makeRegion(co.id, "Central");
    const store = await makeStore("cs-null", { roles: false });
    await db.insert(storeProfiles).values({ storeId: store, companyId: co.id, regionId: region });
    await db.delete(regions).where(eq(regions.id, region));
    const row = await profileOf(store);
    expect([row.companyId, row.regionId]).toEqual([co.id, null]);
  });
});

describe("deleting a store or a company", () => {
  it("takes the store's profile with the store, and nothing of the company", async () => {
    const co = await makeCompany("cs-store");
    const store = await makeStore("cs-store", { roles: false });
    await db.insert(storeProfiles).values({ storeId: store, companyId: co.id });
    await db.delete(organization).where(eq(organization.id, store));
    expect(await profileOf(store)).toBeUndefined();
    expect(await db.select().from(companies).where(eq(companies.id, co.id))).toHaveLength(1);
  });

  it("is refused for a company that still has a store; a person who owns a company cannot be deleted either", async () => {
    const co = await makeCompany("cs-keep");
    await db.insert(storeProfiles).values({ storeId: await makeStore("cs-keep", { roles: false }), companyId: co.id });
    expect(await dbRefusal(db.delete(companies).where(eq(companies.id, co.id)))).toMatch(/violates RESTRICT setting of foreign key constraint "store_profiles_company_id_companies_id_fk"/);
    expect(await dbRefusal(db.delete(user).where(eq(user.id, co.ownerId)))).toMatch(/violates RESTRICT setting of foreign key constraint "companies_owner_user_id_user_id_fk"/);
  });

  it("takes its regions, role assignments and events with an empty company, even one with a regional manager", async () => {
    const co = await makeCompany("cs-gone");
    const region = await makeRegion(co.id, "Gone");
    await db.insert(roleAssignments).values({ userId: await makeAccount("cs-gone-person"), companyId: co.id, role: "regional_manager", regionId: region });
    await db.insert(companyEvents).values({ companyId: co.id, actorName: "Test person", event: "region_added" });
    await db.delete(companies).where(eq(companies.id, co.id));
    expect(await db.select().from(regions).where(eq(regions.companyId, co.id))).toEqual([]);
    expect(await db.select().from(roleAssignments).where(eq(roleAssignments.companyId, co.id))).toEqual([]);
    expect(await db.select().from(companyEvents).where(eq(companyEvents.companyId, co.id))).toEqual([]);
  });
});

describe("company_events is insert-only", () => {
  it("takes an insert, and refuses a direct update, delete or truncate even from the owner", async () => {
    const co = await makeCompany("cs-ev");
    const [row] = await db.insert(companyEvents).values({ companyId: co.id, actorName: "Test person", event: "store_added" }).returning();
    expect(await dbRefusal(db.update(companyEvents).set({ event: "rewritten" }).where(eq(companyEvents.id, row.id)))).toMatch(/company_events is insert-only/);
    expect(await dbRefusal(db.delete(companyEvents).where(eq(companyEvents.id, row.id)))).toMatch(/company_events is insert-only/);
    expect(await dbRefusal(db.execute(sql`truncate company_events`))).toMatch(/company_events is insert-only/);
    expect((await db.select().from(companyEvents).where(eq(companyEvents.id, row.id)))[0].event).toBe("store_added");
  });

  it("keeps a deleted actor's events with the actor cleared and nothing else changed; refuses any other clearing", async () => {
    const co = await makeCompany("cs-actor");
    const actor = await makeAccount("cs-actor");
    const [row] = await db.insert(companyEvents).values({ companyId: co.id, actorId: actor, actorName: "Test person", event: "role_given" }).returning();
    const target = eq(companyEvents.id, row.id);
    expect(await dbRefusal(db.update(companyEvents).set({ actorId: null }).where(target))).toMatch(/insert-only/);
    await db.delete(user).where(eq(user.id, actor));
    const [after] = await db.select().from(companyEvents).where(target);
    expect(after).toEqual({ ...row, actorId: null });
  });
});

describe("help_requests.company_request_id", () => {
  const thread = async (requesterId: string, companyRequestId: string | null, status: "open" | "closed" = "open") =>
    db.insert(helpRequests).values({ requesterId, kind: "company_request", companyRequestId, status, closedBy: status === "closed" ? "admin" : null });

  it("holds one open thread per company request, and a new one once the first is closed", async () => {
    const requesterId = await makeAccount("cs-help");
    const [request] = await db.insert(companyRequests).values({ requesterId, companyName: "Acme" }).returning();
    await thread(requesterId, request.id);
    expect(await dbRefusal(thread(requesterId, request.id))).toMatch(/help_requests_company_request_open_unique/);
    await db.update(helpRequests).set({ status: "closed", closedBy: "admin" }).where(eq(helpRequests.companyRequestId, request.id));
    await thread(requesterId, request.id);
    await thread(requesterId, null);
    await thread(requesterId, null);
  });

  it("keeps the thread, with the link cleared, when the request goes", async () => {
    const requesterId = await makeAccount("cs-help2");
    const [request] = await db.insert(companyRequests).values({ requesterId, companyName: "Acme" }).returning();
    await thread(requesterId, request.id);
    await db.delete(companyRequests).where(eq(companyRequests.id, request.id));
    const rows = await db.select().from(helpRequests).where(eq(helpRequests.requesterId, requesterId));
    expect(rows.map((r) => r.companyRequestId)).toEqual([null]);
  });

  it("clears a request's company link when the company goes, and leaves the request", async () => {
    const co = await makeCompany("cs-link");
    const requesterId = await makeAccount("cs-link-req");
    const [request] = await db.insert(companyRequests).values({ requesterId, companyName: "Acme", status: "approved", companyId: co.id, decidedByName: "Liminal Bloom" }).returning();
    await db.delete(companies).where(eq(companies.id, co.id));
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, request.id)))[0].companyId).toBeNull();
  });
});
