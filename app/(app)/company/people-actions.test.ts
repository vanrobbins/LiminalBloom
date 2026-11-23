// /company's people writes with the real guards and resolveAccess against the dev database; only Better Auth's
// session is stood in for. Who may write is the person's real company role: an owner and a corporate admin hold
// company.people, a regional manager and a store member hold none; the hand-off is the owner's alone; and nobody
// reaches another company or acts at or above their own rank.

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
import { companies, companyInvitations, roleAssignments } from "@/db/schema";
import { dropPeople, makePerson } from "@/lib/access/test-roles";
import { dropCompanies, makeCompanyStore, makeStaffedCompany } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";

import { handOffOwnershipAction } from "./ownership-actions";
import { cancelCompanyInvitationAction, changeRegionAction, inviteCompanyPersonAction, removeCompanyPersonAction } from "./people-actions";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

beforeEach(() => vi.clearAllMocks());

const signedInAs = (userId: string) => mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Test person", email: `${userId}@example.com` }, session: { id: "s", activeStoreId: null, activeOrganizationId: null } });
const assignment = async (userId: string) => (await db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId)))[0];
const pending = async (companyId: string) => (await db.select().from(companyInvitations).where(eq(companyInvitations.companyId, companyId))).filter((i) => i.status === "pending");

describe("the owner", { timeout: 30_000 }, () => {
  it("invites a corporate admin and a regional manager, cancels, changes a region, removes, and hands off", async () => {
    const s = await makeStaffedCompany("pa-owner");
    signedInAs(s.owner);
    const admin = await inviteCompanyPersonAction("a@example.test", "corporate_admin", null);
    expect(admin).toMatchObject({ status: "created", email: "a@example.test" });
    expect(await inviteCompanyPersonAction("b@example.test", "regional_manager", s.south)).toMatchObject({ status: "created" });
    expect(await pending(s.company.id)).toHaveLength(2);
    if (admin.status !== "created") throw new Error("not created");
    expect(await cancelCompanyInvitationAction(admin.id)).toMatchObject({ status: "saved" });
    expect(await changeRegionAction(s.manager, s.south, (await assignment(s.manager)).version)).toMatchObject({ status: "saved" });
    expect((await assignment(s.manager)).regionId).toBe(s.south);
    expect(await removeCompanyPersonAction(s.manager, (await assignment(s.manager)).version)).toMatchObject({ status: "saved" });
    const [{ version }] = await db.select({ version: companies.version }).from(companies).where(eq(companies.id, s.company.id));
    expect(await handOffOwnershipAction(s.admin, version)).toMatchObject({ status: "handed" });
    expect((await db.select().from(companies).where(eq(companies.id, s.company.id)))[0].ownerUserId).toBe(s.admin);
  });
});

describe("a corporate admin", { timeout: 30_000 }, () => {
  it("invites only regional managers, removes only them, and cannot hand off", async () => {
    const s = await makeStaffedCompany("pa-admin");
    signedInAs(s.admin);
    expect(await inviteCompanyPersonAction("c@example.test", "corporate_admin", null)).toMatchObject({ status: "refused" });
    expect(await inviteCompanyPersonAction("d@example.test", "regional_manager", s.north)).toMatchObject({ status: "created" });
    expect(await removeCompanyPersonAction(s.admin, (await assignment(s.admin)).version)).toMatchObject({ status: "refused" });
    expect(await handOffOwnershipAction(s.admin, 1)).toMatchObject({ status: "refused", message: "Only the owner can hand off ownership." });
    expect((await db.select().from(companies).where(eq(companies.id, s.company.id)))[0].ownerUserId).toBe(s.owner);
    expect(await removeCompanyPersonAction(s.manager, (await assignment(s.manager)).version)).toMatchObject({ status: "saved" });
  });
});

describe("people without company.people", { timeout: 30_000 }, () => {
  it("a regional manager is refused every write, and nothing changes", async () => {
    const s = await makeStaffedCompany("pa-rm");
    signedInAs(s.manager);
    const refused = { status: "refused", message: "Your role can't change the company's people." };
    expect(await inviteCompanyPersonAction("e@example.test", "regional_manager", s.north)).toEqual(refused);
    expect(await removeCompanyPersonAction(s.admin, 1)).toEqual(refused);
    expect(await changeRegionAction(s.manager, s.south, 1)).toEqual(refused);
    expect(await handOffOwnershipAction(s.admin, 1)).toMatchObject({ status: "refused" });
    expect(await pending(s.company.id)).toHaveLength(0);
    expect(await assignment(s.admin)).toBeDefined();
  });

  it("a store member of the company holds no company role: the guard sends them to /no-access", async () => {
    const s = await makeStaffedCompany("pa-member");
    const store = await makeCompanyStore(s.company.id, s.north, "pa-member-store");
    const clerk = await makePerson(store.store, store.roles.store_manager);
    signedInAs(clerk.userId);
    await expect(inviteCompanyPersonAction("f@example.test", "regional_manager", s.north)).rejects.toThrow("redirect:/no-access");
  });
});

describe("another company", { timeout: 30_000 }, () => {
  it("is out of reach: the owner's actions never touch a person or invitation of another company", async () => {
    const mine = await makeStaffedCompany("pa-mine");
    const theirs = await makeStaffedCompany("pa-theirs");
    signedInAs(theirs.owner);
    const theirInvite = await inviteCompanyPersonAction("g@example.test", "corporate_admin", null);
    if (theirInvite.status !== "created") throw new Error("not created");
    signedInAs(mine.owner);
    expect(await removeCompanyPersonAction(theirs.manager, 1)).toMatchObject({ status: "refused" });
    expect(await changeRegionAction(theirs.manager, mine.south, 1)).toMatchObject({ status: "refused" });
    expect(await cancelCompanyInvitationAction(theirInvite.id)).toMatchObject({ status: "refused" });
    expect(await handOffOwnershipAction(theirs.admin, 1)).toMatchObject({ status: "refused" });
    expect(await assignment(theirs.manager)).toBeDefined();
    expect(await pending(theirs.company.id)).toHaveLength(1);
  });
});
