// Migration 0020's app tables against the dev database: the store role is kept out of
// every one, platform_events is insert-only, the help rules, the store cascade and the
// role flag's backfill. What is tested is Postgres refusing rows, so a mock would only
// test the mock. The migration's own backfill statement is read from the file.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { passkey, twoFactor, user } from "@/db/auth-schema";
import { helpMessages, helpRequests, passkeyLastUsed, platformAdmins, platformEvents, roleDefinitions, storeSuspensions } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dbRefusal } from "@/lib/db/test-errors";
import { withStore } from "@/lib/db/with-store";
import { dropStores } from "@/lib/products/test-stores";

const TEST_REASON = "db test: platform tables";

afterAll(async () => {
  // platform_events is insert-only, so a test's rows are removed with its triggers off, in one transaction.
  await db.batch([
    db.execute(sql`alter table platform_events disable trigger user`),
    db.execute(sql`delete from platform_events where reason = ${TEST_REASON}`),
    db.execute(sql`alter table platform_events enable trigger user`),
  ]);
  await dropStores();
  await dropPeople();
});

const anEvent = (over: Partial<typeof platformEvents.$inferInsert> = {}) => ({
  actorName: "Liminal Bloom",
  action: "store_paused",
  targetKind: "store",
  targetId: "test_target",
  targetLabel: "Test target",
  reason: TEST_REASON,
  ...over,
});

/** A throwaway account (a person in a throwaway store, which dropStores and dropPeople remove). */
const anAccount = async (label: string) => (await makePerson((await makeStoreWithRoles(label)).store, null)).userId;

describe("the store role and the new tables", () => {
  const TABLES = [
    ["platform_admins", platformAdmins],
    ["platform_events", platformEvents],
    ["store_suspensions", storeSuspensions],
    ["help_requests", helpRequests],
    ["help_messages", helpMessages],
    ["passkey_last_used", passkeyLastUsed],
    // Better Auth's, holding secrets: never granted either.
    ["two_factor", twoFactor],
    ["passkey", passkey],
  ] as const;

  it.each(TABLES)("keeps app_store_user out of %s: no grant, so it reads nothing", async (name, table) => {
    const { store } = await makeStoreWithRoles(`pl-rls-${name}`);
    expect(await dbRefusal(withStore(store, [db.select().from(table)]))).toMatch(new RegExp(`permission denied for table ${name}`));
  });

  it("has row-level security on in every one, so a later grant alone would still show nothing", async () => {
    const rows = await db.execute(
      sql`select relname, relrowsecurity from pg_class where relname in ('platform_admins', 'platform_events', 'store_suspensions', 'help_requests', 'help_messages', 'passkey_last_used')`,
    );
    expect(rows.rows.map((r) => [r.relname, r.relrowsecurity]).sort()).toEqual(TABLES.slice(0, 6).map(([name]) => [name, true]).sort());
  });
});

describe("platform_events is insert-only", () => {
  it("takes an insert, and refuses an update, delete or truncate even from the owner", async () => {
    const [row] = await db.insert(platformEvents).values(anEvent()).returning();
    expect(await dbRefusal(db.update(platformEvents).set({ reason: "rewritten" }).where(eq(platformEvents.id, row.id)))).toMatch(/platform_events is insert-only/);
    expect(await dbRefusal(db.delete(platformEvents).where(eq(platformEvents.id, row.id)))).toMatch(/platform_events is insert-only/);
    expect(await dbRefusal(db.execute(sql`truncate platform_events`))).toMatch(/platform_events is insert-only/);
    const [still] = await db.select().from(platformEvents).where(eq(platformEvents.id, row.id));
    expect(still.reason).toBe(TEST_REASON);
  });

  it("lets a deleted account's events stay with the actor cleared and nothing else changed", async () => {
    const userId = await anAccount("pl-actor");
    const [row] = await db.insert(platformEvents).values(anEvent({ actorId: userId })).returning();
    expect(row.actorId).toBe(userId);
    await db.delete(user).where(eq(user.id, userId));
    const [after] = await db.select().from(platformEvents).where(eq(platformEvents.id, row.id));
    expect(after).toEqual({ ...row, actorId: null });
  });

  it("refuses clearing the actor with another change or directly, and setting an actor back", async () => {
    const userId = await anAccount("pl-actor2");
    const [row] = await db.insert(platformEvents).values(anEvent({ actorId: userId })).returning();
    const target = eq(platformEvents.id, row.id);
    expect(await dbRefusal(db.update(platformEvents).set({ actorId: null, reason: "rewritten" }).where(target))).toMatch(/insert-only/);
    expect(await dbRefusal(db.update(platformEvents).set({ actorId: userId, reason: "rewritten" }).where(target))).toMatch(/insert-only/);
    expect(await dbRefusal(db.update(platformEvents).set({ actorId: null }).where(target))).toMatch(/insert-only/);
  });
});

describe("help_requests and help_messages", () => {
  it("holds closed_by exactly when the request is closed, and only as requester or admin", async () => {
    const requesterId = await anAccount("pl-help-check");
    const refusal = /"help_requests_closed_by_check"/;
    expect(await dbRefusal(db.insert(helpRequests).values({ requesterId, kind: "other", status: "closed" }))).toMatch(refusal);
    expect(await dbRefusal(db.insert(helpRequests).values({ requesterId, kind: "other", status: "open", closedBy: "admin" }))).toMatch(refusal);
    expect(await dbRefusal(db.insert(helpRequests).values({ requesterId, kind: "other", status: "answered", closedBy: "requester" }))).toMatch(refusal);
    expect(await dbRefusal(db.insert(helpRequests).values({ requesterId, kind: "other", status: "closed", closedBy: "system" }))).toMatch(/"help_requests_closed_by_known"/);
    await db.insert(helpRequests).values({ requesterId, kind: "other", status: "closed", closedBy: "admin" });
    await db.insert(helpRequests).values({ requesterId, kind: "broken", status: "answered" });
  });

  it("refuses an unknown kind or status, starts open, and keeps context as a server-written object", async () => {
    const requesterId = await anAccount("pl-help-enum");
    expect(await dbRefusal(db.execute(sql`insert into help_requests (requester_id, kind) values (${requesterId}, 'spam')`))).toMatch(/invalid input value for enum help_kind/);
    expect(await dbRefusal(db.execute(sql`insert into help_requests (requester_id, kind, status) values (${requesterId}, 'other', 'stuck')`))).toMatch(
      /invalid input value for enum help_status/,
    );
    const [row] = await db.insert(helpRequests).values({ requesterId, kind: "account" }).returning();
    expect([row.status, row.context, row.version, row.closedBy]).toEqual(["open", {}, 1, null]);
  });

  it("keeps a message to 1 to 2000 characters, and removes a request's messages with it", async () => {
    const requesterId = await anAccount("pl-help-body");
    const [req] = await db.insert(helpRequests).values({ requesterId, kind: "other" }).returning();
    const message = (body: string) => db.insert(helpMessages).values({ requestId: req.id, authorName: "Test person", body });
    expect(await dbRefusal(message(""))).toMatch(/"help_messages_body_length"/);
    expect(await dbRefusal(message("x".repeat(2001)))).toMatch(/"help_messages_body_length"/);
    await message("x");
    await message("x".repeat(2000));
    expect(await db.select().from(helpMessages).where(eq(helpMessages.requestId, req.id))).toHaveLength(2);
    await db.delete(helpRequests).where(eq(helpRequests.id, req.id));
    expect(await db.select().from(helpMessages).where(eq(helpMessages.requestId, req.id))).toEqual([]);
  });

  it("removes a person's requests with the person, but keeps a deleted author's messages with the author cleared", async () => {
    const requesterId = await anAccount("pl-help-user");
    const adminId = await anAccount("pl-help-admin");
    const [req] = await db.insert(helpRequests).values({ requesterId, kind: "other" }).returning();
    await db.insert(helpMessages).values({ requestId: req.id, authorId: adminId, authorName: "Liminal Bloom", fromAdmin: true, body: "Hello" });
    await db.delete(user).where(eq(user.id, adminId));
    const [kept] = await db.select().from(helpMessages).where(eq(helpMessages.requestId, req.id));
    expect([kept.authorId, kept.authorName, kept.fromAdmin]).toEqual([null, "Liminal Bloom", true]);
    await db.delete(user).where(eq(user.id, requesterId));
    expect(await db.select().from(helpRequests).where(eq(helpRequests.id, req.id))).toEqual([]);
  });
});

describe("store_suspensions and platform_admins", () => {
  it("goes when the store is deleted, and holds one row per store", async () => {
    const { store } = await makeStoreWithRoles("pl-susp");
    await db.insert(storeSuspensions).values({ storeId: store, reason: "Testing", suspendedByName: "Liminal Bloom" });
    expect(await dbRefusal(db.insert(storeSuspensions).values({ storeId: store, reason: "Again", suspendedByName: "Liminal Bloom" }))).toMatch(/store_suspensions_pkey/);
    await db.execute(sql`delete from organization where id = ${store}`);
    expect(await db.select().from(storeSuspensions).where(eq(storeSuspensions.storeId, store))).toEqual([]);
  });

  it("goes with the account; the person who added an admin may go without losing the row", async () => {
    const adder = await anAccount("pl-admin-a");
    const admin = await anAccount("pl-admin-b");
    await db.insert(platformAdmins).values({ userId: admin, addedBy: adder, addedByName: "Test person" });
    await db.delete(user).where(eq(user.id, adder));
    const [row] = await db.select().from(platformAdmins).where(eq(platformAdmins.userId, admin));
    expect([row.addedBy, row.addedByName]).toEqual([null, "Test person"]);
    await db.delete(user).where(eq(user.id, admin));
    expect(await db.select().from(platformAdmins).where(eq(platformAdmins.userId, admin))).toEqual([]);
  });
});
