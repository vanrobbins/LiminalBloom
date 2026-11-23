// A company person invites into a company store with no `member` row there (spec 0.7.1 6.4), so the lapse rule
// has a company branch (invitation-lapse.ts): an owner, corporate admin or regional manager of the store's
// region, in an unpaused company, with a rank above the invitation's role. Nobody else keeps one alive.

import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { companies, roleAssignments } from "@/db/schema";
import { dropCompanies, makeCompanyStore, makeRegion, makeStaffedCompany } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";

import { acceptInvitation } from "./invitation-accept";
import { lookInvitation } from "./invitation-look";
import { companyRole } from "./company-roles";
import { createInvitation, type InviteOutcome } from "./invite";
import { dropPeople } from "./test-roles";

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
  if (made.length) await db.delete(user).where(inArray(user.id, made.splice(0)));
});

async function newcomer() {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  made.push(id);
  const email = `colapse_${id}@example.test`;
  await db.insert(user).values({ id, name: "Nia Newcomer", email });
  return { id, name: "Nia Newcomer", email };
}

/** As the action builds it for a company person: their company role's rank and store switches, their own name. */
const actorOf = (userId: string, key: "owner" | "corporate_admin" | "regional_manager") => ({
  userId,
  name: "Ana Admin",
  rank: companyRole(key).rank,
  switches: new Set(companyRole(key).storeSwitches),
});

async function invited(label: string, who: "owner" | "admin" | "manager", regionOfStore: "north" | "south" = "north") {
  const c = await makeStaffedCompany(label);
  const s = await makeCompanyStore(c.company.id, regionOfStore === "north" ? c.north : c.south, label);
  const nia = await newcomer();
  const inviterId = c[who];
  const key = who === "admin" ? "corporate_admin" : who === "manager" ? "regional_manager" : "owner";
  const out: InviteOutcome = await createInvitation(s.store, actorOf(inviterId, key), nia.email, s.roles.store_manager);
  if (out.status !== "created") throw new Error(`not created: ${out.status}`);
  return { c, s, nia, id: out.id, inviterId };
}

describe("a company person's store invitation", () => {
  it("a corporate admin with no member row invites a Store Manager, who accepts", async () => {
    const { nia, id } = await invited("col-admin", "admin");
    expect((await lookInvitation(id, nia)).state).toBe("ready");
    expect(await acceptInvitation(nia, id)).toMatchObject({ status: "accepted", roleName: "Store Manager" });
    expect(await db.select().from(member).where(eq(member.userId, nia.id))).toHaveLength(1);
  });

  it("an owner's invitation is accepted too", async () => {
    const { nia, id } = await invited("col-owner", "owner");
    expect(await acceptInvitation(nia, id)).toMatchObject({ status: "accepted" });
  });

  it("lapses when the inviter's company role is removed", async () => {
    const { nia, id, inviterId } = await invited("col-removed", "admin");
    await db.delete(roleAssignments).where(eq(roleAssignments.userId, inviterId));
    expect((await lookInvitation(id, nia)).state).toBe("lapsed");
    expect(await acceptInvitation(nia, id)).toEqual({ status: "lapsed" });
    expect(await db.select().from(member).where(eq(member.userId, nia.id))).toEqual([]);
  });

  it("lapses when the company is paused", async () => {
    const { c, nia, id } = await invited("col-paused", "owner");
    await db.update(companies).set({ suspendedAt: new Date(), suspendedReason: "test", suspendedByName: "Admin" }).where(eq(companies.id, c.company.id));
    expect((await lookInvitation(id, nia)).state).toBe("lapsed");
    expect(await acceptInvitation(nia, id)).toEqual({ status: "lapsed" });
  });

  it("a regional manager's invitation holds while the store is in their region and lapses when it moves out", async () => {
    // A regional manager (30) outranks a Store Manager (100): their invitation holds while the store is in their region.
    const { c, nia, id } = await invited("col-rm", "manager");
    expect((await lookInvitation(id, nia)).state).toBe("ready");
    // The store moves to another region: the manager no longer reaches it, so it lapses.
    const other = await makeRegion(c.company.id, "West");
    await db.execute(sql`update store_profiles set region_id = ${other} where company_id = ${c.company.id}`);
    expect((await lookInvitation(id, nia)).state).toBe("lapsed");
  });
});
