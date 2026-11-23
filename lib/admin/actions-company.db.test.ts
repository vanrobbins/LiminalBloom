// Liminal Bloom's company actions (spec 0.7.1 7.4) against the dev database: Pause and Restore a company, Cancel a
// company invitation and Hand ownership to a corporate admin. Each is one statement with its platform_events row (the
// company id set, so the owner sees it), and nothing is deleted. The company screens' reads are checked here too.

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companies, companyEvents, companyInvitations, roleAssignments } from "@/db/schema";
import { dropPeople, makePerson } from "@/lib/access/test-roles";
import { eventsFor, makeActor } from "@/lib/access/test-admin-actions";
import { resolveAccess } from "@/lib/access/resolve";
import { dropCompanies, makeCompanyStore, makeStaffedCompany } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";
import { storeDetail } from "@/lib/admin/reads";

import { cancelCompanyInvitationAsAdmin, handOffCompanyAsAdmin, pauseCompany, restoreCompany } from "./actions-company";
import { companyDetail, listCompanies } from "./reads-companies";

const REASON = "db test co-admin: company actions";

afterAll(async () => {
  // platform_events is insert-only: its rows go with its triggers off (as cleanUp does), then the stores, companies and people.
  await db.batch([
    db.execute(sql`alter table platform_events disable trigger user`),
    db.execute(sql`delete from platform_events where reason like 'db test co-admin%'`),
    db.execute(sql`alter table platform_events enable trigger user`),
  ]);
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const company = async (id: string) => (await db.select().from(companies).where(eq(companies.id, id)))[0];
const assignment = async (userId: string) => (await db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId)))[0];

describe("pauseCompany and restoreCompany", () => {
  it("pauses the company: nothing resolves for anyone in it, nothing is deleted, and the owner's record carries the company id", async () => {
    const s = await makeStaffedCompany("ac-pause");
    const store = await makeCompanyStore(s.company.id, s.north, "ac-pause-s");
    const worker = await makePerson(store.store, store.roles.vm_worker);
    const actor = await makeActor("Ada Admin");
    expect((await resolveAccess(s.owner, {})).company).not.toBeNull();

    expect(await pauseCompany(actor, s.company.id, REASON)).toEqual({ status: "done", name: (await company(s.company.id)).name });
    expect(await company(s.company.id)).toMatchObject({ suspendedAt: expect.any(Date), suspendedReason: REASON, suspendedByName: "Ada Admin" });
    expect(await eventsFor(s.company.id)).toEqual([expect.objectContaining({ action: "company_paused", targetKind: "company", companyId: s.company.id, actorName: "Ada Admin", reason: REASON })]);
    for (const who of [s.owner, s.admin, s.manager, worker.userId]) {
      expect(await resolveAccess(who, { activeStoreId: store.store }), who).toMatchObject({ activeStoreId: null, role: null, stores: [], company: null });
    }
    // Nothing deleted: the company's store, its roles and the regions are all still there.
    expect((await companyDetail(s.company.id))?.stores.map((x) => x.id)).toEqual([store.store]);
    expect((await companyDetail(s.company.id))?.regions).toHaveLength(2);
  });

  it("says already for a paused company (no second record) and gone for one that is not there", async () => {
    const s = await makeStaffedCompany("ac-pause2");
    const actor = await makeActor();
    await pauseCompany(actor, s.company.id, REASON);
    expect(await pauseCompany(actor, s.company.id, `${REASON} again`)).toEqual({ status: "already" });
    expect(await eventsFor(s.company.id)).toHaveLength(1);
    expect(await company(s.company.id)).toMatchObject({ suspendedReason: REASON });
    expect(await pauseCompany(actor, randomUUID(), REASON)).toEqual({ status: "gone" });
  });

  it("restores the company: it resolves again for its people, and says already when it is not paused", async () => {
    const s = await makeStaffedCompany("ac-restore");
    const store = await makeCompanyStore(s.company.id, null, "ac-restore-s");
    const actor = await makeActor();
    await pauseCompany(actor, s.company.id, REASON);
    expect(await restoreCompany(actor, s.company.id, REASON)).toEqual({ status: "done", name: (await company(s.company.id)).name });
    expect(await company(s.company.id)).toMatchObject({ suspendedAt: null, suspendedReason: null, suspendedByName: null });
    expect((await eventsFor(s.company.id)).map((e) => e.action).sort()).toEqual(["company_paused", "company_restored"]);
    expect((await resolveAccess(s.owner, { activeStoreId: store.store })).activeStoreId).toBe(store.store);
    expect(await restoreCompany(actor, s.company.id, REASON)).toEqual({ status: "already" });
  });
});

describe("cancelCompanyInvitationAsAdmin", () => {
  it("cancels a pending company invitation and records it on the company; a second cancel says gone", async () => {
    const s = await makeStaffedCompany("ac-inv");
    const id = `ac-inv-${randomUUID()}`;
    const email = `guest-${id}@example.com`;
    await db.insert(companyInvitations).values({ id, companyId: s.company.id, email, role: "corporate_admin", inviterId: s.owner, expiresAt: new Date(Date.now() + 86_400_000) });
    const actor = await makeActor("Ada Admin");
    expect(await cancelCompanyInvitationAsAdmin(actor, id, REASON)).toEqual({ status: "done", email, companyName: (await company(s.company.id)).name });
    expect((await db.select().from(companyInvitations).where(eq(companyInvitations.id, id)))[0].status).toBe("canceled");
    expect(await eventsFor(id)).toEqual([expect.objectContaining({ action: "invitation_canceled", companyId: s.company.id, actorName: "Ada Admin", reason: REASON })]);
    expect(await cancelCompanyInvitationAsAdmin(actor, id, REASON)).toEqual({ status: "gone" });
    expect(await eventsFor(id)).toHaveLength(1);
  });
});

describe("handOffCompanyAsAdmin", { timeout: 30_000 }, () => {
  it("refuses a stale version and a person who is not a corporate admin, changing nothing", async () => {
    const s = await makeStaffedCompany("ac-hand-no");
    const { version } = await company(s.company.id);
    const actor = await makeActor();
    expect(await handOffCompanyAsAdmin(actor, s.company.id, s.admin, version + 5, REASON)).toEqual({ status: "already" });
    expect(await handOffCompanyAsAdmin(actor, s.company.id, s.manager, version, REASON)).toEqual({ status: "gone" });
    expect(await company(s.company.id)).toMatchObject({ ownerUserId: s.owner, version });
  });

  it("makes the corporate admin the owner and the old owner a corporate admin, with the platform record and no company record", async () => {
    const s = await makeStaffedCompany("ac-hand");
    const { version } = await company(s.company.id);
    const actor = await makeActor("Ada Admin");
    expect(await handOffCompanyAsAdmin(actor, s.company.id, s.admin, version, REASON)).toEqual({ status: "done", name: expect.any(String) });
    expect(await company(s.company.id)).toMatchObject({ ownerUserId: s.admin, version: version + 1 });
    expect(await assignment(s.admin)).toBeUndefined();
    expect(await assignment(s.owner)).toMatchObject({ companyId: s.company.id, role: "corporate_admin", regionId: null });
    expect(await eventsFor(s.company.id)).toEqual([expect.objectContaining({ action: "ownership_handed_off", companyId: s.company.id, actorName: "Ada Admin", reason: REASON })]);
    expect(await db.select().from(companyEvents).where(and(eq(companyEvents.companyId, s.company.id), eq(companyEvents.event, "ownership_handed_off")))).toHaveLength(0);
    expect((await resolveAccess(s.admin, {})).company).toMatchObject({ role: "owner" });
  });
});

describe("the company screens' reads", () => {
  it("lists a company with its corporate admins and counts, and gives its detail with the pause and each store's region", async () => {
    const s = await makeStaffedCompany("ac-read");
    const store = await makeCompanyStore(s.company.id, s.north, "ac-read-s");
    await makePerson(store.store, store.roles.vm_worker);
    const row = (await listCompanies()).companies.find((c) => c.id === s.company.id);
    expect(row).toMatchObject({ name: (await company(s.company.id)).name, corporateAdmins: [expect.any(String)], regions: 2, stores: 1, people: 4, paused: false });
    expect(await companyDetail(randomUUID())).toBeNull();
    await pauseCompany(await makeActor(), s.company.id, REASON);
    expect(await companyDetail(s.company.id)).toMatchObject({
      pause: { reason: REASON, byName: "Test Admin" },
      corporateAdmins: [expect.objectContaining({ userId: s.admin })],
      stores: [expect.objectContaining({ id: store.store, region: "North", paused: false })],
    });
    expect(await storeDetail(store.store)).toMatchObject({ company: { id: s.company.id, name: (await company(s.company.id)).name }, region: "North" });
  });
});
