// Creating a company invitation against the dev database (spec 0.7.1 6.5): the roles below the inviter's own, a
// region for a regional manager, the pending limit, a real unique pending address, and the authority re-checked in
// the statement.

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companyEvents, companyInvitations } from "@/db/schema";
import { dropPeople } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { cancelCompanyInvitation, createCompanyInvitation, MAX_COMPANY_INVITATIONS, type CompanyInviter } from "./invite";
import { dropCompanies, emailOf, makeCompany, makeRegion, makeStaffedCompany } from "./test-companies";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const as = (userId: string, role: CompanyInviter["role"]): CompanyInviter => ({ userId, name: `Test ${role}`, role });
const rows = (companyId: string) => db.select().from(companyInvitations).where(eq(companyInvitations.companyId, companyId));
const fresh = () => `new_${randomUUID().slice(0, 8)}@example.test`;
const eventsNamed = (companyId: string, event: string) => db.select().from(companyEvents).where(and(eq(companyEvents.companyId, companyId), eq(companyEvents.event, event)));

describe("createCompanyInvitation", { timeout: 30_000 }, () => {
  it("lets the owner invite a corporate admin or a regional manager, with the event, and the id is the link", async () => {
    const s = await makeStaffedCompany("ci-owner");
    const admin = await createCompanyInvitation(s.company.id, as(s.owner, "owner"), " New.Admin@Example.test ", "corporate_admin", null);
    const manager = await createCompanyInvitation(s.company.id, as(s.owner, "owner"), fresh(), "regional_manager", s.south);
    if (admin.status !== "created" || manager.status !== "created") throw new Error("not created");
    expect(admin.id).toHaveLength(32);
    expect(admin.email).toBe("new.admin@example.test");
    const [row] = await db.select().from(companyInvitations).where(eq(companyInvitations.id, manager.id));
    expect(row).toMatchObject({ role: "regional_manager", regionId: s.south, status: "pending", inviterId: s.owner });
    expect(await eventsNamed(s.company.id, "company_invitation_created")).toHaveLength(2);
  });

  it("refuses a role at or above the inviter's own: a corporate admin invites only regional managers, a regional manager no one", async () => {
    const s = await makeStaffedCompany("ci-rank");
    expect((await createCompanyInvitation(s.company.id, as(s.admin, "corporate_admin"), fresh(), "corporate_admin", null)).status).toBe("forbidden");
    expect((await createCompanyInvitation(s.company.id, as(s.admin, "corporate_admin"), fresh(), "regional_manager", s.north)).status).toBe("created");
    expect((await createCompanyInvitation(s.company.id, as(s.manager, "regional_manager"), fresh(), "regional_manager", s.north)).status).toBe("forbidden");
    expect((await createCompanyInvitation(s.company.id, as(s.owner, "owner"), fresh(), "owner", null)).status).toBe("invalid");
  });

  it("re-checks in the statement that the inviter still holds the role it claims", async () => {
    const s = await makeStaffedCompany("ci-pin");
    // A corporate admin who says they are the owner: the rank check passes, the write does not.
    expect((await createCompanyInvitation(s.company.id, as(s.admin, "owner"), fresh(), "corporate_admin", null)).status).toBe("forbidden");
    expect(await rows(s.company.id)).toHaveLength(0);
  });

  it("needs a region of this company for a regional manager, and none for a corporate admin", async () => {
    const s = await makeStaffedCompany("ci-region");
    const other = await makeCompany("ci-region-other");
    const theirs = await makeRegion(other.id, "Theirs");
    const owner = as(s.owner, "owner");
    expect((await createCompanyInvitation(s.company.id, owner, fresh(), "regional_manager", null)).status).toBe("invalid");
    expect((await createCompanyInvitation(s.company.id, owner, fresh(), "corporate_admin", s.north)).status).toBe("invalid");
    expect((await createCompanyInvitation(s.company.id, owner, fresh(), "regional_manager", theirs)).status).toBe("invalid");
    expect(await rows(s.company.id)).toHaveLength(0);
  });

  it("says who is already in and who is already invited", async () => {
    const s = await makeStaffedCompany("ci-dup");
    const owner = as(s.owner, "owner");
    expect(await createCompanyInvitation(s.company.id, owner, await emailOf(s.admin), "corporate_admin", null)).toMatchObject({ status: "already-member" });
    const email = fresh();
    expect((await createCompanyInvitation(s.company.id, owner, email, "corporate_admin", null)).status).toBe("created");
    expect((await createCompanyInvitation(s.company.id, owner, email.toUpperCase(), "regional_manager", s.north)).status).toBe("already-invited");
    expect((await createCompanyInvitation(s.company.id, owner, "nope", "corporate_admin", null)).status).toBe("bad-email");
  });

  it("cancels an expired pending invitation to the same address in the same statement, so the unique index never blocks", async () => {
    const s = await makeStaffedCompany("ci-expired");
    const email = fresh();
    await db.insert(companyInvitations).values({ id: randomUUID(), companyId: s.company.id, email, role: "corporate_admin", inviterId: s.owner, expiresAt: new Date(Date.now() - 3_600_000) });
    expect((await createCompanyInvitation(s.company.id, as(s.owner, "owner"), email, "corporate_admin", null)).status).toBe("created");
    expect((await rows(s.company.id)).map((r) => r.status).sort()).toEqual(["canceled", "pending"]);
  });

  it("cancels a lapsed one: its inviter holds no authority", async () => {
    const s = await makeStaffedCompany("ci-lapsed");
    const email = fresh();
    // Made by a regional manager, who holds no company.people: it lapsed at once.
    await db.insert(companyInvitations).values({ id: randomUUID(), companyId: s.company.id, email, role: "regional_manager", regionId: s.north, inviterId: s.manager, expiresAt: new Date(Date.now() + 3_600_000) });
    expect((await createCompanyInvitation(s.company.id, as(s.owner, "owner"), email, "regional_manager", s.north)).status).toBe("created");
  });

  it(`stops at ${MAX_COMPANY_INVITATIONS} pending`, async () => {
    const s = await makeStaffedCompany("ci-full");
    const values = Array.from({ length: MAX_COMPANY_INVITATIONS }, (_, i) => ({ id: randomUUID(), companyId: s.company.id, email: `full${i}_${randomUUID().slice(0, 6)}@example.test`, role: "corporate_admin" as const, inviterId: s.owner, expiresAt: new Date(Date.now() + 3_600_000) }));
    await db.insert(companyInvitations).values(values);
    expect((await createCompanyInvitation(s.company.id, as(s.owner, "owner"), fresh(), "corporate_admin", null)).status).toBe("invitations-full");
  });
});

describe("cancelCompanyInvitation", { timeout: 30_000 }, () => {
  it("cancels with an event, only for roles below the actor's own", async () => {
    const s = await makeStaffedCompany("cc");
    const owner = as(s.owner, "owner");
    const admin = await createCompanyInvitation(s.company.id, owner, fresh(), "corporate_admin", null);
    const manager = await createCompanyInvitation(s.company.id, owner, fresh(), "regional_manager", s.north);
    if (admin.status !== "created" || manager.status !== "created") throw new Error("not created");
    expect(await cancelCompanyInvitation(s.company.id, as(s.admin, "corporate_admin"), admin.id)).toEqual({ status: "forbidden" });
    expect((await cancelCompanyInvitation(s.company.id, as(s.admin, "corporate_admin"), manager.id)).status).toBe("cancelled");
    expect((await cancelCompanyInvitation(s.company.id, owner, admin.id)).status).toBe("cancelled");
    expect((await cancelCompanyInvitation(s.company.id, owner, admin.id)).status).toBe("gone");
    expect(await eventsNamed(s.company.id, "company_invitation_cancelled")).toHaveLength(2);
  });

  it("does not reach another company's invitation", async () => {
    const mine = await makeStaffedCompany("cc-mine");
    const theirs = await makeStaffedCompany("cc-theirs");
    const made = await createCompanyInvitation(theirs.company.id, as(theirs.owner, "owner"), fresh(), "corporate_admin", null);
    if (made.status !== "created") throw new Error("not created");
    expect((await cancelCompanyInvitation(mine.company.id, as(mine.owner, "owner"), made.id)).status).toBe("gone");
  });
});
