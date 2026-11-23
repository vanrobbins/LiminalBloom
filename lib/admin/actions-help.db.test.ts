// An admin answers and closes a help request (spec 0.7.1 7.4, 9.2) against the dev database: a reply is one
// statement (message and status together), a close sets status, closed_by and its event together, the 50-message
// limit holds for admins too, and the requester's own reads never carry the admin's name.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { helpMessages, helpRequests } from "@/db/schema";
import { cleanUp, eventsFor, makeActor } from "@/lib/access/test-admin-actions";
import { makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { getThread } from "@/lib/help/queries";
import { openRequest, replyTo } from "@/lib/help/write";

import { adminCloseRequest, adminReplyTo } from "./actions-help";
import { adminHelpList, adminHelpThread } from "./help-reads";

const REASON = "db test: help close";
afterAll(() => cleanUp([REASON]));

async function asker(name = "Rita Requester") {
  const { store } = await makeStoreWithRoles("helpadm");
  const { userId } = await makePerson(store, null);
  const out = await openRequest({ id: userId, name }, { kind: "broken", body: "My planogram will not open.", context: { state: "member", store: { id: store, name: "Pioneer Place" } } });
  if (out.status !== "done" || !out.id) throw new Error("not opened");
  return { userId, id: out.id };
}
const row = async (id: string) => (await db.select().from(helpRequests).where(eq(helpRequests.id, id)))[0];
const messages = (id: string) => db.select().from(helpMessages).where(eq(helpMessages.requestId, id));

describe("adminReplyTo", () => {
  it("adds the message from the admin (name stored) and sets answered together; the requester sees only Liminal Bloom", async () => {
    const actor = await makeActor("Ada Admin");
    const { userId, id } = await asker();
    expect(await adminReplyTo(actor, id, "  Try again now.  ")).toEqual({ status: "done" });
    const r = await row(id);
    expect(r.status).toBe("answered");
    expect(r.version).toBe(2);
    const sent = (await messages(id)).find((m) => m.fromAdmin);
    expect(sent).toMatchObject({ authorId: actor.userId, authorName: "Ada Admin", body: "Try again now." });
    const thread = await getThread(userId, id);
    expect(thread?.messages.at(-1)).toMatchObject({ fromAdmin: true, body: "Try again now." });
    expect(JSON.stringify(thread)).not.toContain("Ada Admin");
  });

  it("refuses an empty or over-long body, a closed request and an unknown one", async () => {
    const actor = await makeActor();
    const { id } = await asker();
    expect(await adminReplyTo(actor, id, "   ")).toEqual({ status: "invalid-body" });
    expect(await adminReplyTo(actor, id, "x".repeat(2001))).toEqual({ status: "invalid-body" });
    expect(await adminReplyTo(actor, "not-a-uuid", "hi")).toEqual({ status: "gone" });
    expect(await adminReplyTo(actor, "00000000-0000-4000-8000-000000000000", "hi")).toEqual({ status: "gone" });
    await adminCloseRequest(actor, id, REASON);
    expect(await adminReplyTo(actor, id, "late")).toEqual({ status: "closed" });
    expect(await messages(id)).toHaveLength(1);
  });

  it("stops at 50 messages, admin replies included", async () => {
    const actor = await makeActor();
    const { id } = await asker();
    await db.insert(helpMessages).values(Array.from({ length: 48 }, (_, i) => ({ requestId: id, authorName: "x", fromAdmin: i % 2 === 0, body: `m${i}` })));
    expect(await adminReplyTo(actor, id, "the 50th")).toEqual({ status: "done" });
    expect(await adminReplyTo(actor, id, "the 51st")).toEqual({ status: "too-many-messages" });
    expect(await messages(id)).toHaveLength(50);
  });
});

describe("adminReplyTo races", () => {
  it("an admin and a requester replying together at 49 messages stop at 50", async () => {
    const actor = await makeActor();
    const { id, userId } = await asker();
    await db.insert(helpMessages).values(Array.from({ length: 48 }, (_, i) => ({ requestId: id, authorName: "x", fromAdmin: i % 2 === 0, body: `m${i}` })));
    await Promise.all([adminReplyTo(actor, id, "admin one"), replyTo({ id: userId, name: "R" }, id, "asker one"), adminReplyTo(actor, id, "admin two"), replyTo({ id: userId, name: "R" }, id, "asker two")]);
    expect(await messages(id)).toHaveLength(50);
  });

  it("a reply and a close at the same instant never leave an answered request with a closed_by", async () => {
    const actor = await makeActor();
    const { id } = await asker();
    const [reply] = await Promise.all([adminReplyTo(actor, id, "one more"), adminCloseRequest(actor, id, REASON)]);
    expect(["done", "closed"]).toContain(reply.status);
    const r = await row(id);
    expect(r.status).toBe("closed");
    expect(r.closedBy).toBe("admin");
    for (let i = 0; i < 3; i++) {
      const fresh = await asker();
      const [, again] = await Promise.all([adminCloseRequest(actor, fresh.id, REASON), adminReplyTo(actor, fresh.id, "late")]);
      expect(["done", "closed"]).toContain(again.status);
      const x = await row(fresh.id);
      expect((x.status === "closed") === (x.closedBy !== null)).toBe(true);
    }
  });
});

describe("adminCloseRequest", () => {
  it("closes by admin and writes the help_closed event in the same statement; closing twice says already and writes no second event", async () => {
    const actor = await makeActor("Ada Admin");
    const { id } = await asker("Rita Requester");
    expect(await adminCloseRequest(actor, id, REASON)).toEqual({ status: "done" });
    expect(await row(id)).toMatchObject({ status: "closed", closedBy: "admin" });
    expect(await eventsFor(id)).toEqual([expect.objectContaining({ action: "help_closed", targetKind: "help_request", targetLabel: "Test person", reason: REASON, actorName: "Ada Admin" })]);
    expect(await adminCloseRequest(actor, id, REASON)).toEqual({ status: "already" });
    expect(await eventsFor(id)).toHaveLength(1);
    expect(await adminCloseRequest(actor, "00000000-0000-4000-8000-000000000000", REASON)).toEqual({ status: "gone" });
  });

  it("is all or nothing: an event that cannot be written leaves the request open", async () => {
    const { id } = await asker();
    await expect(adminCloseRequest({ userId: "nobody-here", name: "Nobody" }, id, REASON)).rejects.toThrow();
    expect((await row(id)).status).toBe("open");
  });
});

describe("admin help reads", () => {
  it("lists open oldest first, replied and closed apart, and the thread carries the requester, context and author names", async () => {
    const actor = await makeActor("Ada Admin");
    const a = await asker("First Person");
    const b = await asker("Second Person");
    const c = await asker("Third Person");
    await adminReplyTo(actor, b.id, "On it.");
    await adminCloseRequest(actor, c.id, REASON);
    const list = await adminHelpList();
    const open = list.open.map((r) => r.id);
    expect(open).toContain(a.id);
    expect(open).not.toContain(b.id);
    expect(open).toEqual([...open].sort((x, y) => list.open.find((r) => r.id === x)!.createdAt.getTime() - list.open.find((r) => r.id === y)!.createdAt.getTime()));
    expect(list.replied.map((r) => r.id)).toContain(b.id);
    expect(list.closed.map((r) => r.id)).toContain(c.id);
    expect(list.open.find((r) => r.id === a.id)).toMatchObject({ requesterName: "Test person", firstLine: "My planogram will not open.", kind: "broken" });

    const thread = await adminHelpThread(b.id);
    expect(thread).toMatchObject({ requesterName: "Test person", status: "answered", context: { state: "member" } });
    expect(thread?.requesterEmail).toContain("@");
    expect(thread?.messages.map((m) => m.authorName)).toEqual(["Second Person", "Ada Admin"]);
    expect(await adminHelpThread("nope")).toBeNull();
  });
});
