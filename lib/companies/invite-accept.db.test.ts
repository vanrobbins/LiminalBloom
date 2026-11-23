// Accepting a company invitation, and the one-company rule at the grants (spec 0.7.1 5.4, 6.5), against the dev
// database: one statement grants the role (never a member row), the inviter's authority lapses the invitation, and a
// person in another company is refused by a company invitation and by a store invitation into a company store.

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member } from "@/db/auth-schema";
import { companies, companyEvents, companyInvitations, roleAssignments } from "@/db/schema";
import { acceptInvitation } from "@/lib/access/invitation-accept";
import { lookInvitation } from "@/lib/access/invitation-look";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { acceptCompanyInvitation } from "./invite-accept";
import { createCompanyInvitation } from "./invite";
import { assignCompanyRole, dropCompanies, emailOf, makeBareAccount, makeCompany, makeCompanyStore, makeStaffedCompany } from "./test-companies";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const person = async (userId: string) => ({ id: userId, name: "Nia Newcomer", email: await emailOf(userId) });
const rolesOf = (userId: string) => db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId));
const membersOf = (userId: string) => db.select().from(member).where(eq(member.userId, userId));

/** An invitation made the real way, by the owner, for a new bare account. */
async function invited(s: Awaited<ReturnType<typeof makeStaffedCompany>>, role: "corporate_admin" | "regional_manager" = "regional_manager", inviter: { userId: string; role: "owner" | "corporate_admin" } = { userId: s.owner, role: "owner" }) {
  const who = await makeBareAccount("newcomer");
  const made = await createCompanyInvitation(s.company.id, { ...inviter, name: "Inviter" }, await emailOf(who), role, role === "regional_manager" ? s.south : null);
  if (made.status !== "created") throw new Error(`not created: ${made.status}`);
  return { who, id: made.id };
}

describe("acceptCompanyInvitation", { timeout: 30_000 }, () => {
  it("gives the role (no member row), marks the invitation, logs it and reports the region", async () => {
    const s = await makeStaffedCompany("ca-ok");
    const { who, id } = await invited(s);
    const out = await acceptCompanyInvitation(await person(who), id);
    expect(out).toMatchObject({ status: "accepted", companyId: s.company.id, regionId: s.south, roleName: "Regional Manager" });
    expect(await rolesOf(who)).toMatchObject([{ companyId: s.company.id, role: "regional_manager", regionId: s.south }]);
    expect(await membersOf(who)).toEqual([]);
    const [row] = await db.select().from(companyInvitations).where(eq(companyInvitations.id, id));
    expect(row.status).toBe("accepted");
    const events = await db.select().from(companyEvents).where(and(eq(companyEvents.companyId, s.company.id), eq(companyEvents.event, "company_role_given")));
    expect(events[0]).toMatchObject({ actorId: who });
    expect(events[0].detail).toMatchObject({ role: "Regional Manager", region: "South" });
  });

  it("works once: a second accept of the link is used", async () => {
    const s = await makeStaffedCompany("ca-twice");
    const { who, id } = await invited(s, "corporate_admin");
    expect((await acceptCompanyInvitation(await person(who), id))?.status).toBe("accepted");
    expect(await acceptCompanyInvitation(await person(who), id)).toEqual({ status: "used" });
    expect(await rolesOf(who)).toHaveLength(1);
  });

  it("is null for an id no company invitation has, so a store invitation takes it", async () => {
    expect(await acceptCompanyInvitation(await person(await makeBareAccount("none")), randomUUID())).toBeNull();
  });

  it("refuses another address, writing nothing", async () => {
    const s = await makeStaffedCompany("ca-refuse");
    const a = await invited(s);
    const stranger = await makeBareAccount("stranger");
    expect(await acceptCompanyInvitation(await person(stranger), a.id)).toEqual({ status: "wrong-email" });
    expect(await rolesOf(stranger)).toEqual([]);
  });

  it("lapses when the inviter loses the authority, and revives nothing for the wrong person", async () => {
    const s = await makeStaffedCompany("ca-lapse");
    const { who, id } = await invited(s, "regional_manager", { userId: s.admin, role: "corporate_admin" });
    expect((await lookInvitation(id, { id: who, email: await emailOf(who) }))).toMatchObject({ state: "ready" });
    await db.delete(roleAssignments).where(eq(roleAssignments.userId, s.admin));
    expect(await lookInvitation(id, null)).toMatchObject({ state: "lapsed" });
    expect(await acceptCompanyInvitation(await person(who), id)).toMatchObject({ status: "lapsed" });
    expect(await rolesOf(who)).toEqual([]);
  });

  it("refuses while the company is paused, writes nothing, and the page says so; it works again once restored", async () => {
    const s = await makeStaffedCompany("ca-paused");
    const { who, id } = await invited(s);
    await db.update(companies).set({ suspendedAt: new Date(), suspendedReason: "test", suspendedByName: "Admin" }).where(eq(companies.id, s.company.id));
    expect((await lookInvitation(id, await person(who))).state).toBe("company-paused");
    expect(await acceptCompanyInvitation(await person(who), id)).toMatchObject({ status: "company-paused" });
    expect(await rolesOf(who)).toEqual([]);
    expect((await db.select().from(companyInvitations).where(eq(companyInvitations.id, id)))[0].status).toBe("pending");
    await db.update(companies).set({ suspendedAt: null, suspendedReason: null, suspendedByName: null }).where(eq(companies.id, s.company.id));
    expect(await acceptCompanyInvitation(await person(who), id)).toMatchObject({ status: "accepted" });
  });

  it("refuses an expired and a cancelled invitation", async () => {
    const s = await makeStaffedCompany("ca-dead");
    const a = await invited(s);
    const b = await invited(s);
    await db.update(companyInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(companyInvitations.id, a.id));
    await db.update(companyInvitations).set({ status: "canceled" }).where(eq(companyInvitations.id, b.id));
    expect(await acceptCompanyInvitation(await person(a.who), a.id)).toMatchObject({ status: "expired" });
    expect(await acceptCompanyInvitation(await person(b.who), b.id)).toEqual({ status: "cancelled" });
  });

  describe("the one-company rule", () => {
    it("refuses an owner of another company, a role in another, and a member of another company's store; names the company", async () => {
      const s = await makeStaffedCompany("oc-co");
      const other = await makeStaffedCompany("oc-other");
      const otherStore = await makeCompanyStore(other.company.id, null, "oc-store");
      const owner = await invited(s);
      const holder = await invited(s);
      const staff = await invited(s);
      await db.update(companyInvitations).set({ email: await emailOf(other.owner) }).where(eq(companyInvitations.id, owner.id));
      await db.update(companyInvitations).set({ email: await emailOf(other.admin) }).where(eq(companyInvitations.id, holder.id));
      const inStore = await makePerson(otherStore.store, otherStore.roles.vm_worker);
      await db.update(companyInvitations).set({ email: await emailOf(inStore.userId) }).where(eq(companyInvitations.id, staff.id));
      const company = other.company;
      const [{ name }] = await db.query.companies.findMany({ where: (c, { eq: is }) => is(c.id, company.id) });
      for (const [id, userId] of [[owner.id, other.owner], [holder.id, other.admin], [staff.id, inStore.userId]] as const) {
        expect(await acceptCompanyInvitation(await person(userId), id)).toEqual({ status: "in-company", companyName: name });
        expect(await lookInvitation(id, { id: userId, email: await emailOf(userId) })).toMatchObject({ state: "in-company", companyName: name });
      }
      expect(await rolesOf(other.admin)).toMatchObject([{ companyId: other.company.id }]);
    });

    it("lets a member of this company's own store take a company role in it (the grants are unioned)", async () => {
      const s = await makeStaffedCompany("oc-same");
      const store = await makeCompanyStore(s.company.id, s.south, "oc-same-store");
      const clerk = await makePerson(store.store, store.roles.vm_worker);
      const made = await createCompanyInvitation(s.company.id, { userId: s.owner, name: "Owner", role: "owner" }, await emailOf(clerk.userId), "regional_manager", s.south);
      if (made.status !== "created") throw new Error("not created");
      expect((await acceptCompanyInvitation(await person(clerk.userId), made.id))?.status).toBe("accepted");
      expect(await membersOf(clerk.userId)).toHaveLength(1);
    });

    it("refuses a store invitation into a company store for someone in another company, and writes no member row", async () => {
      const s = await makeStaffedCompany("oc-store");
      const mine = await makeCompanyStore(s.company.id, s.north, "oc-store-mine");
      const rm = await makeBareAccount("other-rm");
      const otherCo = await makeCompany("oc-store-other");
      await assignCompanyRole(otherCo.id, rm, "corporate_admin");
      const manager = await makePerson(mine.store, mine.roles.store_manager);
      const id = await makeInvitation(mine.store, manager.userId, mine.roles.vm_worker);
      await db.update(invitation).set({ email: await emailOf(rm) }).where(eq(invitation.id, id));
      expect(await acceptInvitation(await person(rm), id)).toEqual({ status: "in-company", companyName: expect.any(String) });
      expect(await membersOf(rm)).toEqual([]);
      expect((await db.select().from(invitation).where(eq(invitation.id, id)))[0].status).toBe("pending");
    });

    it("lets a company person into a standalone store, and a person of this company into this company's store", async () => {
      const s = await makeStaffedCompany("oc-ok");
      const mine = await makeCompanyStore(s.company.id, s.north, "oc-ok-mine");
      const plain = await makeStoreWithRoles("oc-ok-plain");
      const forMine = await makeInvitation(mine.store, (await makePerson(mine.store, mine.roles.store_manager)).userId, mine.roles.vm_worker);
      const forPlain = await makeInvitation(plain.store, (await makePerson(plain.store, plain.roles.store_manager)).userId, plain.roles.vm_worker);
      for (const id of [forMine, forPlain]) await db.update(invitation).set({ email: await emailOf(s.admin) }).where(eq(invitation.id, id));
      expect((await acceptInvitation(await person(s.admin), forMine)).status).toBe("accepted");
      expect((await acceptInvitation(await person(s.admin), forPlain)).status).toBe("accepted");
    });
  });
});
