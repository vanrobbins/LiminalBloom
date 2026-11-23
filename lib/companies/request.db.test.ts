// A company request's other paths against the dev database (spec 0.7.1 5.1, 5.2, 5.3): send and withdraw (one
// pending, an owner refused, only your own), reject with its reason, Ask a question (one thread per request),
// and what the requester's card reads.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { companyRequests, helpMessages, helpRequests, platformEvents } from "@/db/schema";
import { cleanUp, makeActor } from "@/lib/access/test-admin-actions";
import { openRequest } from "@/lib/help/write";
import { getThread } from "@/lib/help/queries";
import { dropStores } from "@/lib/products/test-stores";

import { askAboutRequest } from "./request-ask";
import { requestCardFor, standingCompanyOf } from "./request-reads";
import { rejectRequest } from "./reject";
import { sendRequest, withdrawRequest } from "./request";
import { assignCompanyRole, dropCompanies, makeBareAccount, makeCompany, makeCompanyStore } from "./test-companies";

const REASON = "db test: company request";
afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await cleanUp([REASON]);
});

async function sent(label: string, name = `Request ${label}`) {
  const userId = await makeBareAccount(label);
  const out = await sendRequest(userId, name);
  if (out.status !== "done") throw new Error(out.status);
  const [row] = await db.select().from(companyRequests).where(eq(companyRequests.id, out.id));
  return { userId, id: row.id, version: row.version };
}

describe("sendRequest and withdrawRequest", () => {
  it("sends one pending request with the cleaned name, and a second is refused until it is withdrawn", async () => {
    const userId = await makeBareAccount("one");
    const first = await sendRequest(userId, "  Acme   Co ");
    expect(first.status).toBe("done");
    expect(await sendRequest(userId, "Another")).toEqual({ status: "pending" });
    expect(await sendRequest(userId, "x")).toEqual({ status: "invalid-name" });
    if (first.status !== "done") return;
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, first.id)))[0]).toMatchObject({ companyName: "Acme Co", status: "pending" });
    expect(await withdrawRequest(userId, first.id)).toEqual({ status: "done" });
    expect(await withdrawRequest(userId, first.id)).toEqual({ status: "already" });
    expect((await sendRequest(userId, "Another")).status).toBe("done");
  });

  it("refuses a person who owns a company", async () => {
    const owned = await makeCompany("owns");
    expect(await sendRequest(owned.ownerId, "Second company")).toEqual({ status: "owner" });
    expect(await db.select().from(companyRequests).where(eq(companyRequests.requesterId, owned.ownerId))).toHaveLength(0);
  });

  it("withdraws only your own request, and closes its thread", async () => {
    const mine = await sent("wd-mine");
    const other = await sent("wd-other");
    expect(await withdrawRequest(other.userId, mine.id)).toEqual({ status: "gone" });
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, mine.id)))[0].status).toBe("pending");
    await db.insert(helpRequests).values({ requesterId: mine.userId, kind: "company_request", companyRequestId: mine.id });
    expect(await withdrawRequest(mine.userId, mine.id)).toEqual({ status: "done" });
    expect((await db.select().from(helpRequests).where(eq(helpRequests.companyRequestId, mine.id)))[0]).toMatchObject({ status: "closed", closedBy: "requester" });
  });
});

describe("rejectRequest", () => {
  it("records the reason for the requester, closes the thread and logs it, once", async () => {
    const actor = await makeActor();
    const req = await sent("rej");
    await db.insert(helpRequests).values({ requesterId: req.userId, kind: "company_request", companyRequestId: req.id });
    expect(await rejectRequest(actor, req, REASON)).toEqual({ status: "done" });
    expect((await db.select().from(companyRequests).where(eq(companyRequests.id, req.id)))[0]).toMatchObject({ status: "rejected", decisionReason: REASON, decidedBy: actor.userId });
    expect((await db.select().from(helpRequests).where(eq(helpRequests.companyRequestId, req.id)))[0].status).toBe("closed");
    expect(await db.select().from(platformEvents).where(eq(platformEvents.targetId, req.id))).toEqual([expect.objectContaining({ action: "company_rejected", reason: REASON })]);
    expect(await rejectRequest(actor, req, REASON)).toEqual({ status: "already" });
    expect(await rejectRequest(actor, { id: randomUUID(), version: 1 }, REASON)).toEqual({ status: "gone" });
  });
});

describe("askAboutRequest", () => {
  it("opens one thread linked to the request, answered, and continues it on the next question", async () => {
    const actor = await makeActor("Some Admin");
    const req = await sent("ask");
    expect(await askAboutRequest(actor, req.id, "Which stores is this for?")).toEqual({ status: "done" });
    expect(await askAboutRequest(actor, req.id, "And the region?")).toEqual({ status: "done" });
    const threads = await db.select().from(helpRequests).where(eq(helpRequests.companyRequestId, req.id));
    expect(threads).toEqual([expect.objectContaining({ kind: "company_request", status: "answered", requesterId: req.userId })]);
    expect(await db.select().from(helpMessages).where(eq(helpMessages.requestId, threads[0].id))).toHaveLength(2);
    // The requester reads it as Liminal Bloom, never the admin's name.
    const thread = await getThread(req.userId, threads[0].id);
    expect(thread?.messages.every((m) => m.fromAdmin)).toBe(true);
    expect(JSON.stringify(thread)).not.toContain("Some Admin");
  });

  it("refuses a request that is not pending, and an empty question", async () => {
    const actor = await makeActor();
    const req = await sent("ask-done");
    expect(await askAboutRequest(actor, req.id, "")).toEqual({ status: "invalid-body" });
    await rejectRequest(actor, req, REASON);
    expect(await askAboutRequest(actor, req.id, "Still there?")).toEqual({ status: "not-pending" });
  });
});

describe("the requester asking about their request", () => {
  it("opens a company_request thread tied to it, and a second while it is open is refused", async () => {
    const req = await sent("ask-me");
    const who = { id: req.userId, name: "Asker" };
    const input = { kind: "company_request", body: "Why is it taking long?", context: {}, allowedKinds: ["company_request"] as const, companyRequestId: req.id };
    const first = await openRequest(who, input);
    expect(first.status).toBe("done");
    expect((await db.select().from(helpRequests).where(eq(helpRequests.companyRequestId, req.id)))[0]).toMatchObject({ kind: "company_request", requesterId: req.userId });
    expect(await openRequest(who, input)).toEqual({ status: "already-open" });
    expect((await requestCardFor(req.userId))?.thread).toMatchObject({ answered: false });
  });
});

describe("what the requester reads", () => {
  it("shows a pending request with its thread, a rejected one with its reason, and nothing once withdrawn", async () => {
    const actor = await makeActor();
    const req = await sent("card");
    expect(await requestCardFor(req.userId)).toMatchObject({ name: "Request card", status: "pending", thread: null });
    await askAboutRequest(actor, req.id, "A question?");
    expect((await requestCardFor(req.userId))?.thread).toMatchObject({ answered: true });
    await rejectRequest(actor, req, REASON);
    expect(await requestCardFor(req.userId)).toMatchObject({ status: "rejected", reason: REASON, thread: null });
    const again = await sendRequest(req.userId, "Second try");
    if (again.status === "done") await withdrawRequest(req.userId, again.id);
    expect(await requestCardFor(req.userId)).toBeNull();
  });

  it("names the company a person is in: owner or company role, and none for a person in no company", async () => {
    const co = await makeCompany("standing");
    const admin = await makeBareAccount("standing-admin");
    await assignCompanyRole(co.id, admin, "corporate_admin");
    await makeCompanyStore(co.id, null, "standing-store");
    expect(await standingCompanyOf(co.ownerId)).toMatchObject({ id: co.id, role: "owner" });
    expect(await standingCompanyOf(admin)).toMatchObject({ id: co.id, role: "corporate_admin" });
    expect(await standingCompanyOf(await makeBareAccount("standing-none"))).toBeNull();
  });
});

