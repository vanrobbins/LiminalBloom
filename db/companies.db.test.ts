// Migration 0021's tables against the dev database: the store role is kept out of every one, and
// Postgres refuses the rows the rules forbid (another company's region, a second pending request,
// a second company role). What is tested is Postgres refusing rows, so a mock would only test the mock.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companies, companyEvents, companyInvitations, companyRequests, regions, roleAssignments, storeProfiles } from "@/db/schema";
import { dropPeople } from "@/lib/access/test-roles";
import { dropCompanies, makeAccount, makeCompany, makeRegion } from "@/lib/companies/test-companies";
import { dbRefusal } from "@/lib/db/test-errors";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore } from "@/lib/products/test-stores";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const NEW_TABLES = [
  ["companies", companies],
  ["regions", regions],
  ["store_profiles", storeProfiles],
  ["role_assignments", roleAssignments],
  ["company_invitations", companyInvitations],
  ["company_requests", companyRequests],
  ["company_events", companyEvents],
] as const;

describe("the store role and the company tables", () => {
  it.each(NEW_TABLES)("keeps app_store_user out of %s: no grant, so it reads nothing", async (name, table) => {
    const store = await makeStore(`co-rls-${name}`);
    expect(await dbRefusal(withStore(store, [db.select().from(table)]))).toMatch(new RegExp(`permission denied for table ${name}`));
  });

  it("has row-level security on in every one, so a later grant alone would still show nothing", async () => {
    const names = sql.join(NEW_TABLES.map(([n]) => sql`${n}`), sql`, `);
    const rows = await db.execute(sql`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relname in (${names})`);
    expect(rows.rows.map((r) => [r.relname, r.relrowsecurity]).sort()).toEqual(NEW_TABLES.map(([name]) => [name, true]).sort());
  });

  it("adds session.active_store_id as a plain nullable text column", async () => {
    const rows = await db.execute(sql`select data_type, is_nullable from information_schema.columns where table_name = 'session' and column_name = 'active_store_id'`);
    expect(rows.rows).toEqual([{ data_type: "text", is_nullable: "YES" }]);
  });
});

describe("a region belongs to one company", () => {
  it("refuses another company's region on a store profile, a role assignment and an invitation", async () => {
    const mine = await makeCompany("co-reg-a");
    const theirs = await makeCompany("co-reg-b");
    const theirRegion = await makeRegion(theirs.id, "North");
    const store = await makeStore("co-reg", { roles: false });
    const person = await makeAccount("co-reg-person");
    const refusal = (name: string) => new RegExp(`violates foreign key constraint "${name}"`);
    expect(await dbRefusal(db.insert(storeProfiles).values({ storeId: store, companyId: mine.id, regionId: theirRegion }))).toMatch(refusal("store_profiles_region_fk"));
    expect(await dbRefusal(db.insert(roleAssignments).values({ userId: person, companyId: mine.id, role: "regional_manager", regionId: theirRegion }))).toMatch(
      refusal("role_assignments_region_fk"),
    );
    const invitation = { id: "inv-x", companyId: mine.id, email: "a@example.com", role: "regional_manager" as const, regionId: theirRegion, expiresAt: new Date() };
    expect(await dbRefusal(db.insert(companyInvitations).values(invitation))).toMatch(refusal("company_invitations_region_fk"));
  });

  it("accepts a store with no region, and a store in the company's own region", async () => {
    const co = await makeCompany("co-reg-ok");
    const region = await makeRegion(co.id, "South");
    const [a, b] = [await makeStore("co-ok-a", { roles: false }), await makeStore("co-ok-b", { roles: false })];
    await db.insert(storeProfiles).values([
      { storeId: a, companyId: co.id },
      { storeId: b, companyId: co.id, regionId: region },
    ]);
  });

  it("holds a regional manager's region exactly when the role is regional_manager", async () => {
    const co = await makeCompany("co-role-check");
    const region = await makeRegion(co.id, "East");
    const [p1, p2] = [await makeAccount("co-rc1"), await makeAccount("co-rc2")];
    const refusal = /"role_assignments_role_region"/;
    expect(await dbRefusal(db.insert(roleAssignments).values({ userId: p1, companyId: co.id, role: "regional_manager" }))).toMatch(refusal);
    expect(await dbRefusal(db.insert(roleAssignments).values({ userId: p1, companyId: co.id, role: "corporate_admin", regionId: region }))).toMatch(refusal);
    await db.insert(roleAssignments).values({ userId: p1, companyId: co.id, role: "corporate_admin" });
    await db.insert(roleAssignments).values({ userId: p2, companyId: co.id, role: "regional_manager", regionId: region });
  });

  it("keeps a region's name 1 to 40 characters and unique within its company (ignoring case), but not across companies", async () => {
    const [a, b] = [await makeCompany("co-name-a"), await makeCompany("co-name-b")];
    await makeRegion(a.id, "Coastal");
    expect(await dbRefusal(db.insert(regions).values({ companyId: a.id, name: "COASTAL" }))).toMatch(/regions_company_name_unique/);
    await makeRegion(b.id, "Coastal");
    expect(await dbRefusal(db.insert(regions).values({ companyId: a.id, name: "" }))).toMatch(/"regions_name_length"/);
    expect(await dbRefusal(db.insert(regions).values({ companyId: a.id, name: "x".repeat(41) }))).toMatch(/"regions_name_length"/);
  });
});

describe("one of each per person or company", () => {
  it("lets a person own one company; a name is 2 to 60 characters and a slug is unique", async () => {
    const co = await makeCompany("co-owner");
    const slug = `test-co-second-${Date.now()}`;
    expect(await dbRefusal(db.insert(companies).values({ name: "Second company", slug, ownerUserId: co.ownerId }))).toMatch(/companies_owner_unique/);
    expect(await dbRefusal(db.insert(companies).values({ name: "x", slug, ownerUserId: await makeAccount("co-owner-2") }))).toMatch(/"companies_name_length"/);
    const [mine] = await db.select({ slug: companies.slug }).from(companies).where(eq(companies.id, co.id));
    expect(await dbRefusal(db.insert(companies).values({ name: "Same slug", slug: mine.slug, ownerUserId: await makeAccount("co-owner-3") }))).toMatch(/companies_slug_unique/);
  });

  it("holds one company role per person: user_id is the primary key", async () => {
    const [a, b] = [await makeCompany("co-pk-a"), await makeCompany("co-pk-b")];
    const person = await makeAccount("co-pk-person");
    await db.insert(roleAssignments).values({ userId: person, companyId: a.id, role: "corporate_admin" });
    expect(await dbRefusal(db.insert(roleAssignments).values({ userId: person, companyId: b.id, role: "corporate_admin" }))).toMatch(/role_assignments_pkey/);
  });

  it("holds one pending company request per person, and a new one once it is decided", async () => {
    const requesterId = await makeAccount("co-req");
    const [first] = await db.insert(companyRequests).values({ requesterId, companyName: "Acme" }).returning();
    expect(await dbRefusal(db.insert(companyRequests).values({ requesterId, companyName: "Acme Two" }))).toMatch(/company_requests_pending_unique/);
    await db.update(companyRequests).set({ status: "rejected", decidedByName: "Liminal Bloom", decisionReason: "No" }).where(eq(companyRequests.id, first.id));
    await db.insert(companyRequests).values({ requesterId, companyName: "Acme Two" });
    expect(await dbRefusal(db.insert(companyRequests).values({ requesterId: await makeAccount("co-req2"), companyName: "A" }))).toMatch(/"company_requests_name_length"/);
  });

  it("holds one pending invitation per company and email, and a new one once it is canceled", async () => {
    const co = await makeCompany("co-inv");
    const invite = (id: string) => ({ id, companyId: co.id, email: "new@example.com", role: "corporate_admin" as const, expiresAt: new Date(Date.now() + 48 * 3_600_000) });
    await db.insert(companyInvitations).values(invite("co-inv-1"));
    expect(await dbRefusal(db.insert(companyInvitations).values(invite("co-inv-2")))).toMatch(/company_invitations_pending_unique/);
    expect(await dbRefusal(db.insert(companyInvitations).values({ ...invite("co-inv-3"), email: "NEW@Example.com" }))).toMatch(/company_invitations_pending_unique/);
    await db.update(companyInvitations).set({ status: "canceled" }).where(eq(companyInvitations.id, "co-inv-1"));
    await db.insert(companyInvitations).values(invite("co-inv-2"));
  });
});
