// Creating an invitation against the dev database (spec 0.7, 4.8 part 5 and 4.9):
// the rank rule on the role, every refusal the dialog lists, the 48 hour expiry,
// and that the invitation and its access_events row are written together or not at all.

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { applyInvitation, createInvitation, MAX_INVITATIONS, MAX_PEOPLE } from "./invite";
import { actorIn, eventsOf, personIn, type Setup } from "./people-test";
import { dropPeople, makeStoreWithRoles } from "./test-roles";

const bulkUsers: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (bulkUsers.length) await db.delete(user).where(inArray(user.id, bulkUsers.splice(0)));
});

const rowsOf = (store: string) => db.select().from(invitation).where(eq(invitation.organizationId, store));
const emailOf = async (userId: string) => (await db.select({ e: user.email }).from(user).where(eq(user.id, userId)))[0].e;

/** `n` more people in the store (or invitations from `inviter`), written in bulk. */
async function crowdWith(s: Setup, n: number, what: "members" | "invitations", inviter: string) {
  const ids = Array.from({ length: n }, (_, i) => `test_acc_bulk_${s.store.slice(0, 6)}_${i}_${Math.random().toString(36).slice(2, 8)}`);
  if (what === "members") {
    bulkUsers.push(...ids);
    await db.insert(user).values(ids.map((id) => ({ id, name: id, email: `${id}@example.com` })));
    await db.insert(member).values(ids.map((id) => ({ id: `m_${id}`, organizationId: s.store, userId: id, role: "member", roleId: s.roles.sales_associate, createdAt: new Date() })));
  } else {
    await db.insert(invitation).values(ids.map((id) => ({ id, organizationId: s.store, email: `${id}@example.com`, roleId: s.roles.sales_associate, expiresAt: new Date(Date.now() + 3_600_000), inviterId: inviter })));
  }
}

describe("createInvitation", () => {
  it("writes a pending invitation into the role, lowercase email, 48 hours, and the event beside it", async () => {
    const s = await makeStoreWithRoles("inv-create");
    const actor = await actorIn(s, "vm_manager");
    const now = new Date("2026-11-11T15:40:00.000Z");
    const out = await createInvitation(s.store, actor, "  Jane.Park@Example.TEST ", s.roles.sales_associate, now);
    expect(out).toMatchObject({ status: "created", email: "jane.park@example.test", roleName: "Sales Associate" });
    if (out.status !== "created") throw new Error("not created");
    expect(out.expiresAt.toISOString()).toBe("2026-11-13T15:40:00.000Z");
    expect(out.id.length).toBeGreaterThanOrEqual(32);

    const [row] = await rowsOf(s.store);
    expect(row).toMatchObject({ id: out.id, email: "jane.park@example.test", status: "pending", role: "member", roleId: s.roles.sales_associate, inviterId: actor.userId });
    expect(row.expiresAt.toISOString()).toBe("2026-11-13T15:40:00.000Z");
    const events = await eventsOf(s.store);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: "invitation_created", actorId: actor.userId });
    expect(events[0].detail).toMatchObject({ email: "jane.park@example.test", role: "Sales Associate" });
    // The id is the secret that lets someone in: it is not copied into the log.
    expect(JSON.stringify(events[0].detail)).not.toContain(out.id);
  });

  it("refuses a role at or above the actor's, and an actor without people.manage; nothing is written", async () => {
    const s = await makeStoreWithRoles("inv-rank");
    const assistant = await actorIn(s, "assistant_manager");
    for (const role of ["assistant_manager", "store_manager"] as const) {
      expect(await createInvitation(s.store, assistant, "a@example.test", s.roles[role])).toEqual({ status: "forbidden" });
    }
    const worker = await actorIn(s, "vm_worker");
    expect(await createInvitation(s.store, worker, "a@example.test", s.roles.sales_associate)).toEqual({ status: "forbidden" });
    expect(await rowsOf(s.store)).toEqual([]);
    expect(await eventsOf(s.store)).toEqual([]);
    // Equal rank is the line: one step down is allowed.
    expect((await createInvitation(s.store, assistant, "a@example.test", s.roles.vm_manager)).status).toBe("created");
  });

  it("refuses a role that is not in this store (another store's, or none)", async () => {
    const s = await makeStoreWithRoles("inv-role");
    const other = await makeStoreWithRoles("inv-role-other");
    const actor = await actorIn(s, "store_manager");
    expect(await createInvitation(s.store, actor, "a@example.test", other.roles.sales_associate)).toEqual({ status: "invalid" });
    expect(await createInvitation(s.store, actor, "a@example.test", "no-such-role")).toEqual({ status: "invalid" });
    expect(await rowsOf(s.store)).toEqual([]);
  });

  it("refuses an empty or malformed email", async () => {
    const s = await makeStoreWithRoles("inv-email");
    const actor = await actorIn(s, "store_manager");
    for (const bad of ["", "   ", "jane", "jane@", "@example.test", "jane @example.test", `${"a".repeat(260)}@example.test`]) {
      expect(await createInvitation(s.store, actor, bad, s.roles.sales_associate)).toEqual({ status: "bad-email" });
    }
    expect(await rowsOf(s.store)).toEqual([]);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses someone already in the store, by email in any letter case, naming them; another store's members don't count", async () => {
    const s = await makeStoreWithRoles("inv-member");
    const other = await makeStoreWithRoles("inv-member-other");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const there = await emailOf(jane.userId);
    expect(await createInvitation(s.store, actor, there.toUpperCase(), s.roles.sales_associate)).toEqual({ status: "already-member", name: "Jane sales_associate" });
    const elsewhere = await personIn(other, "sales_associate");
    expect((await createInvitation(s.store, actor, await emailOf(elsewhere.userId), s.roles.sales_associate)).status).toBe("created");
  });

  it("refuses a second invitation while one is waiting; an expired, cancelled or accepted one doesn't block", async () => {
    const s = await makeStoreWithRoles("inv-dup");
    const actor = await actorIn(s, "store_manager");
    const now = new Date();
    expect((await createInvitation(s.store, actor, "dup@example.test", s.roles.sales_associate, now)).status).toBe("created");
    expect(await createInvitation(s.store, actor, "DUP@example.test", s.roles.vm_worker, now)).toEqual({ status: "already-invited" });
    expect(await rowsOf(s.store)).toHaveLength(1);

    await db.update(invitation).set({ expiresAt: new Date(now.getTime() - 1000) }).where(eq(invitation.organizationId, s.store));
    expect((await createInvitation(s.store, actor, "dup@example.test", s.roles.sales_associate, now)).status).toBe("created");
    for (const status of ["canceled", "accepted"]) {
      await db.update(invitation).set({ status }).where(eq(invitation.organizationId, s.store));
      expect((await createInvitation(s.store, actor, "dup@example.test", s.roles.sales_associate, now)).status).toBe("created");
    }
  });

  it("refuses at 100 people, and allows the 100th", async () => {
    const s = await makeStoreWithRoles("inv-people");
    const actor = await actorIn(s, "store_manager");
    await crowdWith(s, MAX_PEOPLE - 2, "members", actor.userId);
    expect((await createInvitation(s.store, actor, "ok@example.test", s.roles.sales_associate)).status).toBe("created");
    await crowdWith(s, 1, "members", actor.userId);
    expect(await createInvitation(s.store, actor, "late@example.test", s.roles.sales_associate)).toEqual({ status: "people-full" });
  });

  it("refuses at 100 waiting invitations; an expired one is not counted", async () => {
    const s = await makeStoreWithRoles("inv-full");
    const actor = await actorIn(s, "store_manager");
    await crowdWith(s, MAX_INVITATIONS, "invitations", actor.userId);
    expect(await createInvitation(s.store, actor, "late@example.test", s.roles.sales_associate)).toEqual({ status: "invitations-full" });
    const [one] = await rowsOf(s.store);
    await db.update(invitation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitation.id, one.id));
    expect((await createInvitation(s.store, actor, "late@example.test", s.roles.sales_associate)).status).toBe("created");
  });
});

describe("applyInvitation, the write alone", () => {
  it("re-checks in the statement itself: a duplicate that appeared after the checks writes nothing", async () => {
    const s = await makeStoreWithRoles("inv-race");
    const actor = await actorIn(s, "store_manager");
    const role = { id: s.roles.sales_associate, name: "Sales Associate" };
    expect((await applyInvitation(s.store, actor, "race@example.test", role, new Date())).status).toBe("created");
    expect(await applyInvitation(s.store, actor, "race@example.test", role, new Date())).toEqual({ status: "already-invited" });
    expect(await rowsOf(s.store)).toHaveLength(1);
    expect(await eventsOf(s.store)).toHaveLength(1);
  });
});
