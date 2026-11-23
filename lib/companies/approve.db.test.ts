// Approving a company request against the dev database (spec 0.7.1 5.3): one batch that makes the company, takes
// the person out of their old one, keeps their standalone stores, and refuses an owner or a taken slug without
// changing anything.

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { accessEvents, companies, companyEvents, companyRequests, helpRequests, platformEvents, roleAssignments } from "@/db/schema";
import { cleanUp, makeActor } from "@/lib/access/test-admin-actions";
import { makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";
import { assignCompanyRole, dropCompanies, makeBareAccount, makeCompany, makeCompanyStore } from "./test-companies";

import { approveRequest } from "./approve";
import { sendRequest, withdrawRequest } from "./request";

const REASON = "db test: approve company request";
const requesters: string[] = [];
afterAll(async () => {
  // Companies an approval made have an owner the account delete restricts, so they go first.
  if (requesters.length > 0) await db.delete(companies).where(inArray(companies.ownerUserId, requesters));
  await dropStores();
  await dropCompanies();
  await cleanUp([REASON]);
});

async function requester(label: string) {
  const id = await makeBareAccount(label);
  requesters.push(id);
  return id;
}
const join = (store: string, userId: string) => db.insert(member).values({ id: randomUUID(), organizationId: store, userId, role: "member", roleId: null, createdAt: new Date() });
async function request(userId: string, name: string) {
  const sent = await sendRequest(userId, name);
  if (sent.status !== "done") throw new Error(`not sent: ${sent.status}`);
  const [row] = await db.select().from(companyRequests).where(eq(companyRequests.id, sent.id));
  return { id: row.id, version: row.version };
}
const uniqueName = (label: string) => `Approve ${label} ${randomUUID().slice(0, 6)}`;
const memberOf = async (store: string, userId: string) => (await db.select().from(member).where(and(eq(member.organizationId, store), eq(member.userId, userId)))).length;

describe("approveRequest", () => {
  it("makes the company with the requester as owner, marks the request, closes its thread and logs it", async () => {
    const actor = await makeActor();
    const who = await requester("plain");
    const name = uniqueName("plain");
    const req = await request(who, name);
    await db.insert(helpRequests).values({ requesterId: who, kind: "company_request", companyRequestId: req.id });
    const out = await approveRequest(actor, req, REASON);
    expect(out).toMatchObject({ status: "done", name });
    if (out.status !== "done") return;
    const [company] = await db.select().from(companies).where(eq(companies.id, out.companyId));
    expect(company).toMatchObject({ ownerUserId: who, name });
    expect(company.slug).toMatch(/^approve-plain-/);
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, req.id)))[0]).toMatchObject({ status: "approved", companyId: out.companyId, decidedBy: actor.userId, decisionReason: REASON, version: req.version + 1 });
    expect((await db.select().from(helpRequests).where(eq(helpRequests.companyRequestId, req.id)))[0]).toMatchObject({ status: "closed", closedBy: "admin" });
    expect(await db.select().from(platformEvents).where(eq(platformEvents.targetId, req.id))).toEqual([expect.objectContaining({ action: "company_approved", companyId: out.companyId, reason: REASON })]);
    expect((await db.select().from(companyEvents).where(eq(companyEvents.companyId, out.companyId))).map((e) => e.event)).toEqual(["company_created"]);
  });

  it("takes the person out of their old company and keeps their standalone store", async () => {
    const actor = await makeActor();
    const old = await makeCompany("old");
    const companyStore = await makeCompanyStore(old.id, null, "old-store");
    const standalone = await makeStoreWithRoles("standalone");
    const who = await requester("leaver");
    await assignCompanyRole(old.id, who, "corporate_admin");
    await join(companyStore.store, who);
    await join(standalone.store, who);
    const req = await request(who, uniqueName("leaver"));
    expect(await approveRequest(actor, req, REASON)).toMatchObject({ status: "done" });
    expect(await db.select().from(roleAssignments).where(eq(roleAssignments.userId, who))).toHaveLength(0);
    expect(await memberOf(companyStore.store, who)).toBe(0);
    expect(await memberOf(standalone.store, who)).toBe(1);
    expect(await db.select().from(accessEvents).where(eq(accessEvents.storeId, companyStore.store))).toEqual([expect.objectContaining({ event: "member_left_company", actorName: "Liminal Bloom", actorId: null })]);
    expect((await db.select().from(companyEvents).where(eq(companyEvents.companyId, old.id))).map((e) => e.event)).toEqual(["person_left"]);
  });

  it("takes a plain member of a company store out of it too", async () => {
    const actor = await makeActor();
    const old = await makeCompany("old2");
    const store = await makeCompanyStore(old.id, null, "old2-store");
    const who = await requester("staff");
    await join(store.store, who);
    expect(await approveRequest(actor, await request(who, uniqueName("staff")), REASON)).toMatchObject({ status: "done" });
    expect(await memberOf(store.store, who)).toBe(0);
  });

  it("refuses an owner and changes nothing", async () => {
    const actor = await makeActor();
    const owned = await makeCompany("owned");
    // They became an owner after asking (a hand-off), so the request is pending though sending one is refused.
    const [row] = await db.insert(companyRequests).values({ requesterId: owned.ownerId, companyName: uniqueName("owner") }).returning();
    const req = { id: row.id, version: row.version };
    expect(await sendRequest(owned.ownerId, "Another one")).toEqual({ status: "owner" });
    expect(await approveRequest(actor, req, REASON)).toEqual({ status: "owner", companyName: "Test company owned" });
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, req.id)))[0].status).toBe("pending");
    expect(await db.select().from(platformEvents).where(eq(platformEvents.targetId, req.id))).toHaveLength(0);
  });

  it("refuses a taken slug and changes nothing, the old company included", async () => {
    const actor = await makeActor();
    const old = await makeCompany("old3");
    const store = await makeCompanyStore(old.id, null, "old3-store");
    const first = await requester("first");
    const second = await requester("second");
    await assignCompanyRole(old.id, second, "corporate_admin");
    await join(store.store, second);
    const name = uniqueName("slug");
    expect(await approveRequest(actor, await request(first, name), REASON)).toMatchObject({ status: "done" });
    const again = await request(second, name.toUpperCase());
    expect(await approveRequest(actor, again, REASON)).toEqual({ status: "slug-taken" });
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, again.id)))[0].status).toBe("pending");
    expect(await db.select().from(roleAssignments).where(eq(roleAssignments.userId, second))).toHaveLength(1);
    expect(await memberOf(store.store, second)).toBe(1);
  });

  it("says already for a decided request or a stale version, and gone for an unknown id", async () => {
    const actor = await makeActor();
    const who = await requester("twice");
    const req = await request(who, uniqueName("twice"));
    expect(await approveRequest(actor, { id: req.id, version: req.version + 5 }, REASON)).toEqual({ status: "already" });
    expect(await approveRequest(actor, req, REASON)).toMatchObject({ status: "done" });
    expect(await approveRequest(actor, req, REASON)).toEqual({ status: "already" });
    expect(await approveRequest(actor, { id: randomUUID(), version: 1 }, REASON)).toEqual({ status: "gone" });
  });

  it("is all or nothing: an actor that cannot be logged leaves the old company alone", async () => {
    const old = await makeCompany("old4");
    const who = await requester("atomic");
    await assignCompanyRole(old.id, who, "corporate_admin");
    const req = await request(who, uniqueName("atomic"));
    await expect(approveRequest({ userId: randomUUID(), name: "Nobody" }, req, REASON)).rejects.toThrow();
    expect(await db.select().from(roleAssignments).where(eq(roleAssignments.userId, who))).toHaveLength(1);
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, req.id)))[0].status).toBe("pending");
  });

  it("does not approve a withdrawn request: no company, and the old company is left alone", async () => {
    const actor = await makeActor();
    const old = await makeCompany("old5");
    const store = await makeCompanyStore(old.id, null, "old5-store");
    const who = await requester("withdrawn");
    await assignCompanyRole(old.id, who, "corporate_admin");
    await join(store.store, who);
    const req = await request(who, uniqueName("withdrawn"));
    expect(await withdrawRequest(who, req.id)).toEqual({ status: "done" });
    expect(await approveRequest(actor, req, REASON)).toEqual({ status: "already" });
    expect(await db.select().from(companies).where(eq(companies.ownerUserId, who))).toHaveLength(0);
    expect(await db.select().from(roleAssignments).where(eq(roleAssignments.userId, who))).toHaveLength(1);
    expect(await memberOf(store.store, who)).toBe(1);
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, req.id)))[0].status).toBe("withdrawn");
  });

  it("a withdraw and an approve at the same time never leave a company behind a withdrawn request", async () => {
    const actor = await makeActor();
    const old = await makeCompany("old6");
    const store = await makeCompanyStore(old.id, null, "old6-store");
    const who = await requester("racing");
    await join(store.store, who);
    const req = await request(who, uniqueName("racing"));
    const [, out] = await Promise.all([withdrawRequest(who, req.id), approveRequest(actor, req, REASON)]);
    const [after] = await db.select().from(companyRequests).where(eq(companyRequests.id, req.id));
    const made = await db.select().from(companies).where(eq(companies.ownerUserId, who));
    if (after.status === "approved") {
      expect(out.status).toBe("done");
      expect(made).toHaveLength(1);
      expect(await memberOf(store.store, who)).toBe(0);
    } else {
      expect(after.status).toBe("withdrawn");
      expect(out.status).toBe("already");
      expect(made).toHaveLength(0);
      expect(await memberOf(store.store, who)).toBe(1);
    }
  });
});
