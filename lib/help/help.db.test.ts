// Help requests against the dev database (spec 0.7.1 9.2): the limits, the states, and that one person cannot
// read, reply to, close or mark seen another's thread. Rows are written as the owner with the ids filtered
// by hand (DECISIONS 11-12), so every query is tested for that filter. An admin's reply is simulated here by
// a direct write; the admin side is built in A8.

import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { helpMessages, helpRequests } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { helpRepliesFor } from "./badge";
import { getThread, listRequests } from "./queries";
import { closeRequest, markSeen, openRequest, replyTo } from "./write";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

async function asker(name = "Asker") {
  const { store } = await makeStoreWithRoles("help");
  const { userId } = await makePerson(store, null);
  return { id: userId, name };
}
const BODY = "My planogram will not open.";
const open = (u: { id: string; name: string }, body = BODY) => openRequest(u, { kind: "broken", body, context: { state: "member" } });
async function idOf(u: { id: string; name: string }, body = BODY) {
  const out = await open(u, body);
  if (out.status !== "done" || !out.id) throw new Error("not opened");
  return out.id;
}
/** What Liminal Bloom's reply does (A8 builds the real one): a message from the admin, status answered, updated_at moves on. */
async function adminReplies(id: string, body = "Try again now.") {
  await db.insert(helpMessages).values({ requestId: id, authorId: null, authorName: "Some Admin", fromAdmin: true, body });
  await db.update(helpRequests).set({ status: "answered", updatedAt: sql`now()` }).where(eq(helpRequests.id, id));
}
const row = async (id: string) => (await db.select().from(helpRequests).where(eq(helpRequests.id, id)))[0];
const count = async (id: string) => (await db.select().from(helpMessages).where(eq(helpMessages.requestId, id))).length;

describe("openRequest", () => {
  it("makes an open request with its first message and the context it was given", async () => {
    const u = await asker("Ada");
    const out = await openRequest(u, { kind: "account", body: BODY, context: { state: "no-store", from: "/welcome" } });
    expect(out.status).toBe("done");
    const r = await row((out as { id: string }).id);
    expect(r).toMatchObject({ requesterId: u.id, kind: "account", status: "open", closedBy: null, context: { state: "no-store", from: "/welcome" } });
    const [m] = await db.select().from(helpMessages).where(eq(helpMessages.requestId, r.id));
    expect(m).toMatchObject({ authorId: u.id, authorName: "Ada", fromAdmin: false, body: BODY });
  });

  it("refuses the sixth open request, counts replied ones as open, and a closed one frees a place", async () => {
    const u = await asker();
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push(await idOf(u));
    expect(await open(u)).toEqual({ status: "too-many-open" });
    expect(await listRequests(u.id)).toHaveLength(5);
    await adminReplies(ids[0]);
    expect(await open(u)).toEqual({ status: "too-many-open" });
    expect((await closeRequest(u.id, ids[1])).status).toBe("done");
    expect((await open(u)).status).toBe("done");
  });

  it("refuses a body or kind that is not allowed, writing nothing", async () => {
    const u = await asker();
    expect(await open(u, "short")).toEqual({ status: "invalid-body" });
    expect(await openRequest(u, { kind: "company_request", body: BODY, context: {} })).toEqual({ status: "invalid-kind" });
    expect(await listRequests(u.id)).toEqual([]);
  });

  it("limits are per person: another person still has their five", async () => {
    const a = await asker();
    const b = await asker();
    for (let i = 0; i < 5; i++) await idOf(a);
    expect((await open(b)).status).toBe("done");
  });
});

describe("replyTo and the states", () => {
  it("a reply to an answered request puts it back to waiting, and the badge falls", async () => {
    const u = await asker();
    const id = await idOf(u);
    await adminReplies(id);
    expect(await row(id)).toMatchObject({ status: "answered" });
    expect(await helpRepliesFor(u.id)).toBe(1);
    expect(await replyTo(u, id, "Still stuck")).toEqual({ status: "done" });
    expect(await row(id)).toMatchObject({ status: "open", closedBy: null });
    expect(await helpRepliesFor(u.id)).toBe(0);
    expect(await count(id)).toBe(3);
  });

  it("refuses an empty reply, a reply to a closed request and the 51st message", async () => {
    const u = await asker();
    const id = await idOf(u);
    expect(await replyTo(u, id, "  ")).toEqual({ status: "invalid-body" });
    for (let i = 1; i < 50; i++) expect((await replyTo(u, id, `more ${i}`)).status).toBe("done");
    expect(await count(id)).toBe(50);
    expect(await replyTo(u, id, "one more")).toEqual({ status: "too-many-messages" });
    expect(await count(id)).toBe(50);
    await closeRequest(u.id, id);
    expect(await replyTo(u, id, "after close")).toEqual({ status: "closed" });
    expect(await count(id)).toBe(50);
  }, 60_000);

  it("closing marks who closed it, once; closing again says it is already closed", async () => {
    const u = await asker();
    const id = await idOf(u);
    expect(await closeRequest(u.id, id)).toEqual({ status: "done" });
    expect(await row(id)).toMatchObject({ status: "closed", closedBy: "requester" });
    expect(await closeRequest(u.id, id)).toEqual({ status: "closed" });
  });

  it("opening the thread marks it seen, which clears the badge without touching updated_at", async () => {
    const u = await asker();
    const id = await idOf(u);
    await adminReplies(id);
    const before = (await row(id)).updatedAt;
    expect(await helpRepliesFor(u.id)).toBe(1);
    await markSeen(u.id, id);
    expect(await helpRepliesFor(u.id)).toBe(0);
    expect((await row(id)).updatedAt).toEqual(before);
    await db.update(helpRequests).set({ updatedAt: new Date(Date.now() + 5000) }).where(eq(helpRequests.id, id));
    expect(await helpRepliesFor(u.id)).toBe(1);
  });
});

describe("queries", () => {
  it("lists my requests newest first with the first line, and marks an unseen reply", async () => {
    const u = await asker();
    const first = await idOf(u, "First line\nand more text here");
    await new Promise((r) => setTimeout(r, 15));
    await idOf(u, "Second request text");
    await adminReplies(first);
    const list = await listRequests(u.id);
    expect(list.map((r) => r.firstLine)).toEqual(["Second request text", "First line"]);
    expect(list.map((r) => r.unread)).toEqual([false, true]);
  });

  it("a thread reads oldest first and never carries the admin's name or id", async () => {
    const u = await asker("Ada");
    const id = await idOf(u);
    await adminReplies(id);
    const thread = await getThread(u.id, id);
    expect(thread?.messages.map((m) => [m.fromAdmin, m.body])).toEqual([[false, BODY], [true, "Try again now."]]);
    expect(JSON.stringify(thread)).not.toContain("Some Admin");
    expect(thread).toMatchObject({ status: "answered", unread: true });
  });

  it("is null for an id that is not a thread", async () => {
    const u = await asker();
    expect(await getThread(u.id, "not-a-uuid")).toBeNull();
    expect(await getThread(u.id, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("another person's thread", () => {
  it("cannot be read, replied to, closed or marked seen, and is not listed", async () => {
    const owner = await asker();
    const other = await asker();
    const id = await idOf(owner);
    await adminReplies(id);

    expect(await getThread(other.id, id)).toBeNull();
    expect(await listRequests(other.id)).toEqual([]);
    expect(await replyTo(other, id, "I am not the owner")).toEqual({ status: "gone" });
    expect(await closeRequest(other.id, id)).toEqual({ status: "gone" });
    await markSeen(other.id, id);

    expect(await count(id)).toBe(2);
    expect(await row(id)).toMatchObject({ status: "answered", closedBy: null, requesterSeenAt: null });
    expect(await helpRepliesFor(other.id)).toBe(0);
    expect(await helpRepliesFor(owner.id)).toBe(1);
    expect(await db.select().from(helpRequests).where(and(eq(helpRequests.id, id), eq(helpRequests.requesterId, owner.id)))).toHaveLength(1);
  });
});
