// Handing ownership to a corporate admin against the dev database (spec 0.7.1 5.5): one batch, pinned to the company
// version and to the person still being a corporate admin; the old owner stays as a corporate admin.

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companies, companyEvents, roleAssignments } from "@/db/schema";
import { resolveAccess } from "@/lib/access/resolve";
import { dropPeople } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { handOffOwnership } from "./handoff";
import { dropCompanies, makeBareAccount, makeCompanyStore, makeStaffedCompany } from "./test-companies";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const company = async (id: string) => (await db.select().from(companies).where(eq(companies.id, id)))[0];
const assignment = async (userId: string) => (await db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId)))[0];

describe("handOffOwnership", { timeout: 30_000 }, () => {
  it("makes the corporate admin the owner, the old owner a corporate admin, and logs it; the company stays reachable", async () => {
    const s = await makeStaffedCompany("ho-ok");
    const store = await makeCompanyStore(s.company.id, null, "ho-ok-store");
    const { version } = await company(s.company.id);
    expect(await handOffOwnership(s.company.id, { userId: s.owner, name: "Old Owner" }, s.admin, version)).toMatchObject({ status: "handed" });
    expect(await company(s.company.id)).toMatchObject({ ownerUserId: s.admin, version: version + 1 });
    expect(await assignment(s.admin)).toBeUndefined();
    expect(await assignment(s.owner)).toMatchObject({ companyId: s.company.id, role: "corporate_admin", regionId: null });
    const [event] = await db.select().from(companyEvents).where(and(eq(companyEvents.companyId, s.company.id), eq(companyEvents.event, "ownership_handed_off")));
    expect(event.detail).toMatchObject({ from: "Old Owner" });
    expect((await resolveAccess(s.admin, {})).company).toMatchObject({ role: "owner" });
    const old = await resolveAccess(s.owner, {});
    expect(old.company).toMatchObject({ role: "corporate_admin" });
    expect(old.stores.map((x) => x.id)).toEqual([store.store]);
  });

  it("is pinned to the company version the owner saw: a rename meanwhile changes nothing", async () => {
    const s = await makeStaffedCompany("ho-pin");
    const { version } = await company(s.company.id);
    await db.update(companies).set({ version: version + 1 }).where(eq(companies.id, s.company.id));
    expect(await handOffOwnership(s.company.id, { userId: s.owner, name: "Owner" }, s.admin, version)).toEqual({ status: "stale" });
    expect(await company(s.company.id)).toMatchObject({ ownerUserId: s.owner });
    expect(await assignment(s.admin)).toMatchObject({ role: "corporate_admin" });
  });

  it("needs the person to still be a corporate admin of this company: not a regional manager, not removed, not another company's", async () => {
    const s = await makeStaffedCompany("ho-target");
    const other = await makeStaffedCompany("ho-target-other");
    const { version } = await company(s.company.id);
    const owner = { userId: s.owner, name: "Owner" };
    expect(await handOffOwnership(s.company.id, owner, s.manager, version)).toEqual({ status: "gone" });
    expect(await handOffOwnership(s.company.id, owner, other.admin, version)).toEqual({ status: "gone" });
    expect(await handOffOwnership(s.company.id, owner, await makeBareAccount("ho-nobody"), version)).toEqual({ status: "gone" });
    await db.delete(roleAssignments).where(eq(roleAssignments.userId, s.admin));
    expect(await handOffOwnership(s.company.id, owner, s.admin, version)).toEqual({ status: "gone" });
    expect(await company(s.company.id)).toMatchObject({ ownerUserId: s.owner });
  });

  it("is the owner's alone: a corporate admin, a regional manager, a stranger and the owner to themselves are refused", async () => {
    const s = await makeStaffedCompany("ho-owner");
    const { version } = await company(s.company.id);
    for (const actor of [s.admin, s.manager, await makeBareAccount("ho-stranger")]) {
      expect(await handOffOwnership(s.company.id, { userId: actor, name: "Not owner" }, s.admin, version)).toEqual({ status: "forbidden" });
    }
    expect(await handOffOwnership(s.company.id, { userId: s.owner, name: "Owner" }, s.owner, version)).toEqual({ status: "forbidden" });
    expect(await company(s.company.id)).toMatchObject({ ownerUserId: s.owner });
    expect(await assignment(s.admin)).toBeDefined();
  });

  it("a hand-off is final for the old owner: the same call again is refused", async () => {
    const s = await makeStaffedCompany("ho-twice");
    const { version } = await company(s.company.id);
    const owner = { userId: s.owner, name: "Owner" };
    await handOffOwnership(s.company.id, owner, s.admin, version);
    expect(await handOffOwnership(s.company.id, owner, s.admin, version + 1)).toEqual({ status: "forbidden" });
  });
});
