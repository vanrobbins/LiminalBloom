// Sign out everywhere, Cancel invitation and Make Store Manager (spec 0.7.1 7.4) against the dev database:
// each is one statement that changes the rows and writes its platform_events row (and the store's
// access_events row, signed "Liminal Bloom") together, or changes nothing.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, session, user } from "@/db/auth-schema";
import { makeInvitation, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { makeStore } from "@/lib/products/test-stores";

import { cancelStoreInvitation, makeStoreManager, signOutEverywhere } from "./actions-core";
import { cleanUp, eventsFor, makeActor, storeEvents } from "@/lib/access/test-admin-actions";

const REASON = "db test: admin core actions";
afterAll(() => cleanUp([REASON]));

const sessionRow = (userId: string) => ({ id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date(Date.now() + 3_600_000) });

describe("signOutEverywhere", () => {
  it("deletes every session of the person and writes the event, in one statement", async () => {
    const actor = await makeActor();
    const { userId } = await makePerson((await makeStoreWithRoles("so")).store, null);
    await db.insert(session).values([sessionRow(userId), sessionRow(userId)]);
    expect(await signOutEverywhere(actor, userId, REASON)).toEqual({ status: "done", sessions: 2 });
    expect(await db.select().from(session).where(eq(session.userId, userId))).toHaveLength(0);
    expect(await eventsFor(userId)).toEqual([expect.objectContaining({ action: "signed_out_everywhere", targetKind: "user", actorId: actor.userId, actorName: "Test Admin", reason: REASON })]);
  });

  it("says gone for an account that does not exist, and writes nothing", async () => {
    const id = randomUUID();
    expect(await signOutEverywhere(await makeActor(), id, REASON)).toEqual({ status: "gone" });
    expect(await eventsFor(id)).toHaveLength(0);
  });

  it("is all or nothing: an event that cannot be written leaves the sessions alone", async () => {
    const { userId } = await makePerson((await makeStoreWithRoles("so2")).store, null);
    await db.insert(session).values(sessionRow(userId));
    // An actor id with no account breaks the event's foreign key.
    await expect(signOutEverywhere({ userId: randomUUID(), name: "Nobody" }, userId, REASON)).rejects.toThrow();
    expect(await db.select().from(session).where(eq(session.userId, userId))).toHaveLength(1);
  });
});

describe("cancelStoreInvitation", () => {
  it("cancels a pending invitation and writes both events, the store's signed Liminal Bloom without the admin's id", async () => {
    const actor = await makeActor();
    const { store, roles } = await makeStoreWithRoles("ci");
    const { userId } = await makePerson(store, roles.store_manager);
    const id = await makeInvitation(store, userId, roles.assistant_manager);
    expect(await cancelStoreInvitation(actor, id, REASON)).toMatchObject({ status: "done" });
    expect((await db.select().from(invitation).where(eq(invitation.id, id)))[0].status).toBe("canceled");
    expect(await eventsFor(id)).toEqual([expect.objectContaining({ action: "invitation_canceled", targetKind: "invitation", reason: REASON })]);
    expect(await storeEvents(store)).toEqual([expect.objectContaining({ event: "invitation_cancelled", actorName: "Liminal Bloom", actorId: null, detail: expect.objectContaining({ role: "Assistant Manager", invitationId: id }) })]);
  });

  it("says gone for one that is not pending (already accepted or canceled) and writes nothing", async () => {
    const { store } = await makeStoreWithRoles("ci2");
    const { userId } = await makePerson(store, null);
    const id = await makeInvitation(store, userId, null);
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, id));
    expect(await cancelStoreInvitation(await makeActor(), id, REASON)).toEqual({ status: "gone" });
    expect(await eventsFor(id)).toHaveLength(0);
    expect(await storeEvents(store)).toHaveLength(0);
  });
});

describe("makeStoreManager", () => {
  async function setup() {
    const { store, roles } = await makeStoreWithRoles("msm");
    const worker = await makePerson(store, roles.sales_associate);
    await db.update(user).set({ name: "Jane Park" }).where(eq(user.id, worker.userId));
    return { store, roles, worker };
  }
  const roleOf = async (memberId: string) => (await db.select({ r: member.roleId }).from(member).where(eq(member.id, memberId)))[0]?.r;

  it("gives the person the store's Store Manager role, keeps the existing managers, and writes both events", async () => {
    const actor = await makeActor();
    const { store, roles, worker } = await setup();
    const existing = await makePerson(store, roles.store_manager);
    expect(await makeStoreManager(actor, store, worker.userId, REASON)).toEqual({ status: "done", name: "Jane Park" });
    expect(await roleOf(worker.memberId)).toBe(roles.store_manager);
    expect(await roleOf(existing.memberId)).toBe(roles.store_manager);
    expect(await eventsFor(worker.userId)).toEqual([expect.objectContaining({ action: "store_manager_made", targetKind: "user", detail: expect.objectContaining({ storeId: store, from: "Sales Associate" }) })]);
    expect(await storeEvents(store)).toEqual([expect.objectContaining({ event: "member_role_changed", actorName: "Liminal Bloom", actorId: null, detail: expect.objectContaining({ person: "Jane Park", from: "Sales Associate", to: "Store Manager" }) })]);
  });

  it("says already for someone who is one, and gone for someone not in the store, writing nothing more", async () => {
    const actor = await makeActor();
    const { store, worker } = await setup();
    await makeStoreManager(actor, store, worker.userId, REASON);
    expect(await makeStoreManager(actor, store, worker.userId, REASON)).toEqual({ status: "already" });
    const outsider = await makePerson((await makeStoreWithRoles("msm-o")).store, null);
    expect(await makeStoreManager(actor, store, outsider.userId, REASON)).toEqual({ status: "gone" });
    expect(await eventsFor(outsider.userId)).toHaveLength(0);
    expect(await storeEvents(store)).toHaveLength(1);
  });

  it("is invalid for a store with no Store Manager role, and leaves the member's role alone", async () => {
    const bare = await makeStore("msm-bare", { roles: false });
    const p = await makePerson(bare, null);
    expect(await makeStoreManager(await makeActor(), bare, p.userId, REASON)).toEqual({ status: "invalid" });
    expect(await roleOf(p.memberId)).toBeNull();
  });
});
