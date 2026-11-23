// The admin reads (spec 0.7.1 7.3) against the development database: account facts only, every id
// filtered by hand, as the table owner. Rows are made as the owner too; the tests check what is read.

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, session, user } from "@/db/auth-schema";
import { helpRequests, platformAdmins, platformEvents, storeSuspensions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";

import { adminOverview, listStores, recentEvents, storeDetail } from "./reads";
import { lookupPerson } from "./reads-people";

const REASON = "db test: admin reads";
const helpIds: string[] = [];

afterAll(async () => {
  // platform_events is insert-only, so a test's rows go with its triggers off, in one batch (db/platform.db.test.ts).
  await db.batch([
    db.execute(sql`alter table platform_events disable trigger user`),
    db.execute(sql`delete from platform_events where reason = ${REASON}`),
    db.execute(sql`alter table platform_events enable trigger user`),
  ]);
  for (const id of helpIds) await db.delete(helpRequests).where(eq(helpRequests.id, id));
  await dropStores();
  await dropPeople();
});

const anEvent = (over: Partial<typeof platformEvents.$inferInsert> = {}) => ({ actorName: "Reads test", action: "store_paused", targetKind: "store", targetId: "t", targetLabel: "Target", reason: REASON, ...over });

describe("adminOverview and recentEvents", () => {
  it("counts only open help requests as waiting", async () => {
    const { userId } = await makePerson((await makeStoreWithRoles("ovw")).store, null);
    const before = (await adminOverview()).helpWaiting;
    const rows = await db.insert(helpRequests).values([{ requesterId: userId, kind: "other" }, { requesterId: userId, kind: "other", status: "answered" }, { requesterId: userId, kind: "other", status: "closed", closedBy: "admin" }]).returning({ id: helpRequests.id });
    helpIds.push(...rows.map((r) => r.id));
    expect((await adminOverview()).helpWaiting).toBe(before + 1);
  });

  it("lists the newest events first, at most 10 on the overview", async () => {
    await db.insert(platformEvents).values(Array.from({ length: 12 }, (_, i) => anEvent({ targetLabel: `Event ${i}`, createdAt: new Date(Date.now() + 60_000 + i) })));
    const { events } = await adminOverview();
    expect(events).toHaveLength(10);
    expect(events[0].targetLabel).toBe("Event 11");
    const times = events.map((e) => e.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("pages by a limit and says when there is more", async () => {
    const page = await recentEvents({ limit: 5 });
    expect(page.events).toHaveLength(5);
    expect(page.hasMore).toBe(true);
  });

  it("filters by kind", async () => {
    await db.insert(platformEvents).values(anEvent({ action: "admin_added", targetLabel: "Filter me", createdAt: new Date(Date.now() + 120_000) }));
    const page = await recentEvents({ limit: 50, kind: "admin_added" });
    expect(page.events.every((e) => e.action === "admin_added")).toBe(true);
    expect(page.events.map((e) => e.targetLabel)).toContain("Filter me");
  });
});

describe("lookupPerson", () => {
  it("finds an account by its exact email, any case, with its facts and nothing else", async () => {
    const { store } = await makeStoreWithRoles("look");
    const { userId } = await makePerson(store, null);
    await db.update(user).set({ name: "Lena Lookup" }).where(eq(user.id, userId));
    await db.insert(session).values({ id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date(Date.now() + 3_600_000), updatedAt: new Date() });
    await db.insert(session).values({ id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date(Date.now() - 3_600_000), updatedAt: new Date() });
    const found = await lookupPerson(`  ${userId.toUpperCase()}@Example.com `);
    expect(found).toMatchObject({ userId, name: "Lena Lookup", twoFactorEnabled: true, sessions: 1, isAdmin: false });
    expect(found?.stores).toEqual([expect.objectContaining({ id: store, paused: false })]);
    expect(JSON.stringify(found)).not.toMatch(/password|secret|token/i);
  });

  it("shows a paused store, the role in it, and invitations to their address", async () => {
    const { store, roles } = await makeStoreWithRoles("lookroles");
    const { userId } = await makePerson(store, roles.vm_worker);
    await db.insert(storeSuspensions).values({ storeId: store, reason: REASON, suspendedByName: "Reads test" });
    const other = await makeStoreWithRoles("lookinv");
    const inviter = await makePerson(other.store, other.roles.store_manager);
    const invitationId = await makeInvitation(other.store, inviter.userId, other.roles.assistant_manager);
    const [{ email }] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    await db.update(invitation).set({ email }).where(eq(invitation.id, invitationId));
    const found = await lookupPerson(email);
    expect(found?.stores[0]).toMatchObject({ roleName: "Visual Merchandising Worker", paused: true });
    expect(found?.invitations).toEqual([expect.objectContaining({ id: invitationId, storeName: "Test store lookinv", roleName: "Assistant Manager", expired: false })]);
  });

  it("says nothing for an unknown email or a blank search", async () => {
    expect(await lookupPerson("nobody-here@example.com")).toBeNull();
    expect(await lookupPerson("   ")).toBeNull();
  });

  it("marks another admin", async () => {
    const { userId } = await makePerson((await makeStoreWithRoles("lookadm")).store, null);
    await db.insert(platformAdmins).values({ userId, addedByName: "Reads test" });
    const [{ email }] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    expect((await lookupPerson(email))?.isAdmin).toBe(true);
  });
});

describe("listStores and storeDetail", () => {
  it("lists a store with its people count, Store Managers' names and whether it is paused", async () => {
    const { store, roles } = await makeStoreWithRoles("list");
    const manager = await makePerson(store, roles.store_manager);
    await db.update(user).set({ name: "Mona Manager" }).where(eq(user.id, manager.userId));
    await makePerson(store, roles.sales_associate);
    const row = (await listStores()).find((s) => s.id === store);
    expect(row).toMatchObject({ name: "Test store list", people: 2, managers: ["Mona Manager"], paused: false });
    await db.insert(storeSuspensions).values({ storeId: store, reason: REASON, suspendedByName: "Reads test" });
    expect((await listStores()).find((s) => s.id === store)?.paused).toBe(true);
  });

  it("gives a store's people with emails and roles, highest rank first, and its pending invitations only", async () => {
    const { store, roles } = await makeStoreWithRoles("detail");
    const worker = await makePerson(store, roles.vm_worker);
    const manager = await makePerson(store, roles.store_manager);
    const pending = await makeInvitation(store, manager.userId, roles.sales_associate);
    const done = await makeInvitation(store, manager.userId, roles.sales_associate);
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, done));
    const detail = await storeDetail(store);
    expect(detail?.name).toBe("Test store detail");
    expect(detail?.people.map((p) => p.userId)).toEqual([manager.userId, worker.userId]);
    expect(detail?.people[0]).toMatchObject({ roleName: "Store Manager", isManager: true, email: expect.stringContaining("@") });
    expect(detail?.people[1]).toMatchObject({ isManager: false });
    expect(detail?.invitations.map((i) => i.id)).toEqual([pending]);
    expect(detail?.pause).toBeNull();
  });

  it("is null for a store that does not exist", async () => {
    expect(await storeDetail("no-such-store")).toBeNull();
  });

  it("never reads another store's people", async () => {
    const a = await makeStoreWithRoles("isoa");
    const b = await makeStoreWithRoles("isob");
    const inB = await makePerson(b.store, b.roles.store_manager);
    expect((await storeDetail(a.store))?.people.map((p) => p.userId)).not.toContain(inB.userId);
    expect((await storeDetail(b.store))?.people.map((p) => p.userId)).toContain(inB.userId);
    expect(await db.select().from(member).where(eq(member.userId, inB.userId))).toHaveLength(1);
  });
});
