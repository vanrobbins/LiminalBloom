// Help races against the dev database: a reply after a close, and concurrent writers meeting the limits.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { helpMessages, helpRequests } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { MAX_MESSAGES, MAX_OPEN_REQUESTS } from "./limits";
import { listRequests } from "./queries";
import { closeRequest, openRequest, replyTo } from "./write";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

async function asker() {
  const { store } = await makeStoreWithRoles("race");
  const { userId } = await makePerson(store, null);
  return { id: userId, name: "Racer" };
}
const BODY = "My planogram will not open.";
const open = (u: { id: string; name: string }) => openRequest(u, { kind: "broken", body: BODY, context: {} });
async function idOf(u: { id: string; name: string }) {
  const out = await open(u);
  if (out.status !== "done" || !out.id) throw new Error("not opened");
  return out.id;
}
const count = async (id: string) => (await db.select().from(helpMessages).where(eq(helpMessages.requestId, id))).length;

describe("replyTo races", () => {
  it("a reply after the close is refused as closed and leaves the request closed", async () => {
    const u = await asker();
    const id = await idOf(u);
    await closeRequest(u.id, id);
    expect(await replyTo(u, id, "Anyone there?")).toEqual({ status: "closed" });
    const [r] = await db.select().from(helpRequests).where(eq(helpRequests.id, id));
    expect(r).toMatchObject({ status: "closed", closedBy: "requester" });
    expect(await count(id)).toBe(1);
  });

  it("a reply and a close at the same instant never leave an open request with a closed_by", async () => {
    const u = await asker();
    const id = await idOf(u);
    const [reply] = await Promise.all([replyTo(u, id, "One more thing"), closeRequest(u.id, id)]);
    expect(["done", "closed"]).toContain(reply.status);
    const [r] = await db.select().from(helpRequests).where(eq(helpRequests.id, id));
    expect((r.status === "closed") === (r.closedBy !== null)).toBe(true);
  });

  it("concurrent replies cannot pass the 50-message cap", async () => {
    const u = await asker();
    const id = await idOf(u);
    await db.insert(helpMessages).values(
      Array.from({ length: MAX_MESSAGES - 2 }, () => ({
        requestId: id,
        authorId: u.id,
        authorName: "Racer",
        fromAdmin: false,
        body: "filler",
      })),
    );
    const out = await Promise.all([1, 2, 3, 4].map((i) => replyTo(u, id, `Reply number ${i}`)));
    expect(out.filter((o) => o.status === "done")).toHaveLength(1);
    expect(await count(id)).toBe(MAX_MESSAGES);
  });
});

describe("openRequest races", () => {
  it("concurrent opens cannot pass the limit of open requests", async () => {
    const u = await asker();
    for (let i = 0; i < MAX_OPEN_REQUESTS - 1; i++) await idOf(u);
    const out = await Promise.all([1, 2, 3, 4].map(() => open(u)));
    expect(out.filter((o) => o.status === "done")).toHaveLength(1);
    expect(await listRequests(u.id)).toHaveLength(MAX_OPEN_REQUESTS);
  });
});
