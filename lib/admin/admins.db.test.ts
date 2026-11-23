// Add and remove a Liminal Bloom admin (spec 0.7.1 7.1) against the dev database. platform_admins is shared
// with the real dev admins and other tests, so the last-admin rule is tested through removeAdminAmong, which counts
// only the rows a test made.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";

import { addAdmin, listAdmins, removeAdmin, removeAdminAmong } from "./admins";
import { cleanUp, eventsFor, makeActor } from "@/lib/access/test-admin-actions";

const REASON = "db test: admins";
afterAll(() => cleanUp([REASON]));

const isAdmin = async (userId: string) => (await db.select().from(platformAdmins).where(eq(platformAdmins.userId, userId))).length === 1;
async function person() {
  const { userId } = await makePerson((await makeStoreWithRoles("adm")).store, null);
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  return { userId, email: row.email };
}

describe("addAdmin", () => {
  it("makes an existing account an admin, matching the email in any case, and writes the event", async () => {
    const actor = await makeActor("Ada Admin");
    const p = await person();
    expect(await addAdmin(actor, ` ${p.email.toUpperCase()} `, REASON)).toEqual({ status: "done", userId: p.userId, email: p.email });
    expect(await isAdmin(p.userId)).toBe(true);
    expect((await db.select().from(platformAdmins).where(eq(platformAdmins.userId, p.userId)))[0]).toMatchObject({ addedBy: actor.userId, addedByName: "Ada Admin" });
    expect(await eventsFor(p.userId)).toEqual([expect.objectContaining({ action: "admin_added", targetKind: "admin", targetLabel: p.email, reason: REASON })]);
  });

  it("says no-account for an email with no account (they must sign up first) and already for an admin, writing nothing more", async () => {
    const actor = await makeActor();
    expect(await addAdmin(actor, `nobody-${randomUUID()}@example.com`, REASON)).toEqual({ status: "no-account" });
    const p = await person();
    await addAdmin(actor, p.email, REASON);
    expect(await addAdmin(actor, p.email, REASON)).toEqual({ status: "already" });
    expect(await eventsFor(p.userId)).toHaveLength(1);
  });

  it("is all or nothing: an event that cannot be written leaves no admin row", async () => {
    const p = await person();
    await expect(addAdmin({ userId: randomUUID(), name: "Nobody" }, p.email, REASON)).rejects.toThrow();
    expect(await isAdmin(p.userId)).toBe(false);
  });
});

describe("removeAdmin", () => {
  it("removes an admin while another remains, and writes the event", async () => {
    const actor = await makeActor();
    const a = await person();
    const b = await person();
    await addAdmin(actor, a.email, REASON);
    await addAdmin(actor, b.email, REASON);
    expect(await removeAdmin(actor, a.userId, REASON)).toEqual({ status: "done", email: a.email });
    expect(await isAdmin(a.userId)).toBe(false);
    expect(await isAdmin(b.userId)).toBe(true);
    expect((await eventsFor(a.userId)).map((e) => e.action).sort()).toEqual(["admin_added", "admin_removed"]);
  });

  // The shared table holds real admins and other tests' rows, so these two count only the rows they make (removeAdminAmong).
  it("refuses the last admin, writing nothing", async () => {
    const mine = await person();
    await db.insert(platformAdmins).values({ userId: mine.userId, addedByName: "test" });
    expect(await removeAdminAmong(await makeActor(), mine.userId, REASON, [mine.userId])).toEqual({ status: "last" });
    expect(await isAdmin(mine.userId)).toBe(true);
    expect(await eventsFor(mine.userId)).toHaveLength(0);
  });

  it("two admins removing each other at once leave one (the delete locks the admin rows and counts what is left)", async () => {
    const actor = await makeActor();
    const a = await person();
    const b = await person();
    await db.insert(platformAdmins).values([{ userId: a.userId, addedByName: "test" }, { userId: b.userId, addedByName: "test" }]);
    const among = [a.userId, b.userId];
    const results = await Promise.all([removeAdminAmong(actor, a.userId, REASON, among), removeAdminAmong(actor, b.userId, REASON, among)]);
    expect(results.map((r) => r.status).sort()).toEqual(["done", "last"]);
    expect((await db.select().from(platformAdmins).where(inArray(platformAdmins.userId, among))).length).toBe(1);
  });

  it("says gone for someone who is not an admin", async () => {
    expect(await removeAdmin(await makeActor(), randomUUID(), REASON)).toEqual({ status: "gone" });
  });
});

describe("listAdmins", () => {
  it("lists admins with name, email, who added them and when, oldest first", async () => {
    const actor = await makeActor();
    const p = await person();
    await addAdmin(actor, p.email, REASON);
    const list = await listAdmins();
    expect(list.find((a) => a.userId === p.userId)).toMatchObject({ email: p.email, addedByName: actor.name });
    const times = list.map((a) => a.createdAt.getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });
});
