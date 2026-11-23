// The admin company-request reads (spec 0.7.1 5.3, 7.3) against the development database: the queue in order, one
// request with the requester's account, stores and company, and its latest help thread. Rows are made as the owner.

import { randomUUID } from "node:crypto";

import { count, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { companyRequests, helpMessages, helpRequests } from "@/db/schema";
import { makeStoreWithRoles } from "@/lib/access/test-roles";
import { assignCompanyRole, dropCompanies, makeBareAccount, makeCompany } from "@/lib/companies/test-companies";
import { dropStores } from "@/lib/products/test-stores";

import { adminOverview } from "./reads";
import { adminRequestDetail, adminRequestList } from "./request-reads";

const accounts: string[] = [];
const helpIds: string[] = [];
afterAll(async () => {
  for (const id of helpIds) await db.delete(helpRequests).where(eq(helpRequests.id, id));
  if (accounts.length > 0) await db.delete(companyRequests).where(inArray(companyRequests.requesterId, accounts));
  await dropStores();
  await dropCompanies();
});

async function requester(label: string) {
  const id = await makeBareAccount(label);
  accounts.push(id);
  return id;
}
const ask = async (userId: string, over: Partial<typeof companyRequests.$inferInsert> = {}) => (await db.insert(companyRequests).values({ requesterId: userId, companyName: `Reads ${randomUUID().slice(0, 6)}`, ...over }).returning())[0];

describe("adminRequestList", () => {
  it("puts waiting requests first, oldest first, then the decided ones newest first", async () => {
    const [a, b, c] = await Promise.all([requester("a"), requester("b"), requester("c")]);
    const old = await ask(a, { createdAt: new Date("2020-01-01T00:00:00Z") });
    const newer = await ask(b, { createdAt: new Date("2020-01-02T00:00:00Z") });
    const rejected = await ask(c, { status: "rejected", decisionReason: "no" });
    const { pending, decided } = await adminRequestList();
    const ids = pending.map((r) => r.id);
    expect(ids.indexOf(old.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(old.id)).toBeLessThan(ids.indexOf(newer.id));
    expect(pending.every((r) => r.status === "pending")).toBe(true);
    expect(decided.map((r) => r.id)).toContain(rejected.id);
    expect(decided.find((r) => r.id === rejected.id)).toMatchObject({ status: "rejected", requesterName: "Test c" });
    expect(decided.map((r) => r.id)).not.toContain(old.id);
    const times = decided.map((r) => r.decidedAt.getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });
});

describe("adminOverview", () => {
  it("counts the pending company requests", async () => {
    const who = await requester("count");
    const pendingCount = async () => (await db.select({ n: count() }).from(companyRequests).where(eq(companyRequests.status, "pending")))[0].n;
    await ask(who);
    // The count is database-wide and other test files add requests in parallel, so the read is bracketed by two
    // direct counts: it must land between them, and it can never be less than this test's own waiting request.
    const low = await pendingCount();
    const seen = (await adminOverview()).requestsPending;
    const high = await pendingCount();
    expect(seen).toBeGreaterThanOrEqual(Math.min(low, high));
    expect(seen).toBeLessThanOrEqual(Math.max(low, high));
    expect(seen).toBeGreaterThanOrEqual(1);
  });
});

describe("adminRequestDetail", () => {
  it("reads the request with the requester's account, their stores with roles and the company they are in", async () => {
    const owner = await makeCompany("detail");
    const store = await makeStoreWithRoles("detail-store");
    const who = await requester("detail");
    await db.insert(member).values({ id: randomUUID(), organizationId: store.store, userId: who, role: "member", roleId: null, createdAt: new Date() });
    await assignCompanyRole(owner.id, who, "corporate_admin");
    const req = await ask(who, { companyName: "Detail Co" });
    const read = await adminRequestDetail(req.id);
    expect(read).toMatchObject({ id: req.id, version: req.version, name: "Detail Co", status: "pending", decidedByName: null, reason: null, thread: null });
    expect(read?.requester).toMatchObject({ name: "Test detail", email: expect.stringContaining("@example.com"), company: { id: owner.id, role: "corporate_admin" } });
    expect(read?.requester.stores).toEqual([expect.objectContaining({ id: store.store, roleName: null })]);
  });

  it("carries the latest thread about the request, an open one before a closed one", async () => {
    const who = await requester("thread");
    const req = await ask(who);
    const [closed] = await db.insert(helpRequests).values({ requesterId: who, kind: "company_request", companyRequestId: req.id, status: "closed", closedBy: "admin" }).returning();
    const [open] = await db.insert(helpRequests).values({ requesterId: who, kind: "company_request", companyRequestId: req.id, status: "answered" }).returning();
    helpIds.push(closed.id, open.id);
    await db.insert(helpMessages).values({ requestId: open.id, authorId: who, authorName: "Test thread", fromAdmin: false, body: "Any news?" });
    const read = await adminRequestDetail(req.id);
    expect(read?.thread?.id).toBe(open.id);
    expect(read?.thread?.messages.map((m) => m.body)).toEqual(["Any news?"]);
  });

  it("is null for an unknown id or one that is not an id, and shows no company for a person in none", async () => {
    expect(await adminRequestDetail(randomUUID())).toBeNull();
    expect(await adminRequestDetail("not-an-id")).toBeNull();
    expect(await adminRequestDetail(undefined)).toBeNull();
    const who = await requester("alone");
    expect((await adminRequestDetail((await ask(who)).id))?.requester).toMatchObject({ company: null, stores: [] });
  });

  it("names a decided request's decider and reason", async () => {
    const who = await requester("decided");
    const req = await ask(who, { status: "rejected", decidedByName: "Ada Admin", decisionReason: "Cannot verify" });
    expect(await adminRequestDetail(req.id)).toMatchObject({ status: "rejected", decidedByName: "Ada Admin", reason: "Cannot verify" });
  });
});
