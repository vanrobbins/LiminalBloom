// Accepting an invitation against the dev database (spec 0.7, 4.5 spike findings,
// 4.8 part 5): one statement adds the member with the role, marks the invitation
// accepted and writes the event, and only for the invited email, while the
// invitation is pending and unexpired, the person is not already in, and the store has room.

import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, organization, user } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { acceptInvitation } from "./invitation-accept";
import { MAX_PEOPLE } from "./invite";
import { actorIn, eventsOf, type Setup } from "./people-test";
import { dropPeople, makeInvitation, makeStoreWithRoles } from "./test-roles";

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (made.length) await db.delete(user).where(inArray(user.id, made.splice(0)));
});

/** A signed-up person who belongs to no store. */
async function newcomer(email = `new_${randomUUID().slice(0, 8)}@example.test`) {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  made.push(id);
  await db.insert(user).values({ id, name: "Nia Newcomer", email });
  return { id, name: "Nia Newcomer", email };
}

/** An invitation for `email` into a role of the store, sent by a Store Manager. */
async function inviteFor(s: Setup, email: string, extra: Partial<typeof invitation.$inferInsert> = {}) {
  const inviter = await actorIn(s, "store_manager");
  const id = await makeInvitation(s.store, inviter.userId, s.roles.vm_worker);
  await db.update(invitation).set({ email, ...extra }).where(eq(invitation.id, id));
  return id;
}

const statusOf = async (id: string) => (await db.select({ s: invitation.status }).from(invitation).where(eq(invitation.id, id)))[0].s;
const membersOf = (store: string, userId: string) => db.select().from(member).where(and(eq(member.organizationId, store), eq(member.userId, userId)));

describe("acceptInvitation", () => {
  it("adds the member with the invited role, marks the invitation accepted and logs it, together", async () => {
    const s = await makeStoreWithRoles("acc-ok");
    const [store] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, s.store));
    const nia = await newcomer();
    const id = await inviteFor(s, nia.email);
    const out = await acceptInvitation(nia, id);
    expect(out).toEqual({ status: "accepted", storeId: s.store, storeName: store.name, roleName: "Visual Merchandising Worker" });
    const [row] = await membersOf(s.store, nia.id);
    expect(row).toMatchObject({ roleId: s.roles.vm_worker, role: "member" });
    expect(await statusOf(id)).toBe("accepted");
    const events = (await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: nia.id, actorName: "Nia Newcomer" });
    expect(events[0].detail).toMatchObject({ person: "Nia Newcomer", email: nia.email, role: "Visual Merchandising Worker" });
    expect(JSON.stringify(events[0].detail)).not.toContain(id);
  });

  it("matches the email in any letter case", async () => {
    const s = await makeStoreWithRoles("acc-case");
    const nia = await newcomer("Mixed.Case@Example.Test");
    const id = await inviteFor(s, "mixed.case@example.test");
    expect((await acceptInvitation(nia, id)).status).toBe("accepted");
  });

  it("refuses a different email and writes nothing", async () => {
    const s = await makeStoreWithRoles("acc-wrong");
    const nia = await newcomer();
    const id = await inviteFor(s, "someone.else@example.test");
    expect(await acceptInvitation(nia, id)).toEqual({ status: "wrong-email" });
    expect(await membersOf(s.store, nia.id)).toEqual([]);
    expect(await statusOf(id)).toBe("pending");
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses an expired invitation", async () => {
    const s = await makeStoreWithRoles("acc-expired");
    const nia = await newcomer();
    const id = await inviteFor(s, nia.email, { expiresAt: new Date(Date.now() - 1000) });
    expect(await acceptInvitation(nia, id)).toEqual({ status: "expired" });
    expect(await membersOf(s.store, nia.id)).toEqual([]);
    expect(await statusOf(id)).toBe("pending");
  });

  it("refuses a cancelled one and a used one, and a second accept adds nobody twice", async () => {
    const s = await makeStoreWithRoles("acc-spent");
    const nia = await newcomer();
    const cancelled = await inviteFor(s, nia.email, { status: "canceled" });
    expect(await acceptInvitation(nia, cancelled)).toEqual({ status: "cancelled" });
    const id = await inviteFor(s, nia.email);
    expect((await acceptInvitation(nia, id)).status).toBe("accepted");
    expect(await acceptInvitation(nia, id)).toEqual({ status: "used" });
    expect(await membersOf(s.store, nia.id)).toHaveLength(1);
    expect((await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted")).toHaveLength(1);
  });

  it("refuses someone already in the store and leaves the invitation pending", async () => {
    const s = await makeStoreWithRoles("acc-member");
    const nia = await newcomer();
    await db.insert(member).values({ id: randomUUID(), organizationId: s.store, userId: nia.id, role: "member", roleId: s.roles.sales_associate, createdAt: new Date() });
    const id = await inviteFor(s, nia.email);
    expect(await acceptInvitation(nia, id)).toEqual({ status: "already-member" });
    expect(await membersOf(s.store, nia.id)).toHaveLength(1);
    expect(await statusOf(id)).toBe("pending");
  });

  it("says missing for an id that matches nothing, or an invitation that names no role", async () => {
    const s = await makeStoreWithRoles("acc-missing");
    const nia = await newcomer();
    expect(await acceptInvitation(nia, "no-such-invitation")).toEqual({ status: "missing" });
    const noRole = await inviteFor(s, nia.email, { roleId: null });
    expect(await acceptInvitation(nia, noRole)).toEqual({ status: "missing" });
    expect(await membersOf(s.store, nia.id)).toEqual([]);
  });

  it("refuses when the store already has 100 people", async () => {
    const s = await makeStoreWithRoles("acc-full");
    const nia = await newcomer();
    const ids = Array.from({ length: MAX_PEOPLE }, (_, i) => `test_acc_full_${randomUUID().slice(0, 6)}_${i}`);
    made.push(...ids);
    await db.insert(user).values(ids.map((id) => ({ id, name: id, email: `${id}@example.com` })));
    await db.insert(member).values(ids.map((id) => ({ id: `m_${id}`, organizationId: s.store, userId: id, role: "member", roleId: s.roles.sales_associate, createdAt: new Date() })));
    const id = await inviteFor(s, nia.email);
    expect(await acceptInvitation(nia, id)).toEqual({ status: "full" });
    expect(await membersOf(s.store, nia.id)).toEqual([]);
    expect(await statusOf(id)).toBe("pending");
  });
});

describe("acceptInvitation, at the same moment", () => {
  it("two accepts of one invitation add the person once", async () => {
    const s = await makeStoreWithRoles("acc-twice");
    const nia = await newcomer();
    const id = await inviteFor(s, nia.email);
    const outcomes = await Promise.all([acceptInvitation(nia, id), acceptInvitation(nia, id)]);
    expect(outcomes.filter((o) => o.status === "accepted")).toHaveLength(1);
    expect(await membersOf(s.store, nia.id)).toHaveLength(1);
    expect((await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted")).toHaveLength(1);
  });
});
