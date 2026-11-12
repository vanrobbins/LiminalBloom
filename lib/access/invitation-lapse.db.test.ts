// An invitation carries its inviter's authority (DECISIONS 11-12): accepting re-checks,
// in the accept statement itself, that the inviter is still in the store, still holds
// people.manage and still ranks strictly above the invitation's role. Otherwise the
// invitation has lapsed: it is refused and nothing is written.

import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { acceptInvitation } from "./invitation-accept";
import { actorIn, eventsOf, type Setup } from "./people-test";
import { applyRemoval, readTarget } from "./people-write";
import type { BuiltinRoleKey } from "./roles";
import { dropPeople, makeInvitation, makeStoreWithRoles } from "./test-roles";

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (made.length) await db.delete(user).where(inArray(user.id, made.splice(0)));
});

async function newcomer() {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  made.push(id);
  const email = `lapse_${id}@example.test`;
  await db.insert(user).values({ id, name: "Nia Newcomer", email });
  return { id, name: "Nia Newcomer", email };
}

/**
 * A store with a bystander Store Manager (so a check that only asks "does anyone in the
 * store qualify" cannot pass by luck), an inviter in `inviterKey`, and a pending
 * invitation from them into `into` for a newcomer.
 */
async function setup(label: string, inviterKey: BuiltinRoleKey, into: BuiltinRoleKey) {
  const s = await makeStoreWithRoles(label);
  await actorIn(s, "store_manager");
  const inviter = await actorIn(s, inviterKey);
  const nia = await newcomer();
  const id = await makeInvitation(s.store, inviter.userId, s.roles[into]);
  await db.update(invitation).set({ email: nia.email }).where(eq(invitation.id, id));
  return { s, inviter, nia, id };
}

const statusOf = async (id: string) => (await db.select({ s: invitation.status }).from(invitation).where(eq(invitation.id, id)))[0].s;
const membersOf = (userId: string) => db.select().from(member).where(eq(member.userId, userId));

/** Refused as lapsed, with nothing written: no member, still pending, no event. */
async function expectLapsed(s: Setup, nia: { id: string; name: string; email: string }, id: string) {
  expect(await acceptInvitation(nia, id)).toEqual({ status: "lapsed" });
  expect(await membersOf(nia.id)).toEqual([]);
  expect(await statusOf(id)).toBe("pending");
  expect((await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted")).toEqual([]);
}

describe("an invitation lapses when its inviter can no longer grant its role", () => {
  it("control: an inviter who is in the store, holds people.manage and outranks the role is accepted", async () => {
    const { s, nia, id } = await setup("lapse-ok", "vm_manager", "vm_worker");
    expect(await acceptInvitation(nia, id)).toMatchObject({ status: "accepted", roleName: "Visual Merchandising Worker" });
    expect(await membersOf(nia.id)).toHaveLength(1);
    expect((await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted")).toHaveLength(1);
  });

  it("lapses when the inviter was removed from the store", async () => {
    const { s, inviter, nia, id } = await setup("lapse-removed", "vm_manager", "vm_worker");
    await db.delete(member).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter was re-roled to the invitation's rank, losing people.manage", async () => {
    const { s, inviter, nia, id } = await setup("lapse-equal", "vm_manager", "vm_worker");
    await db.update(member).set({ roleId: s.roles.vm_worker }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter was re-roled to a role that still holds people.manage but ranks no higher than the invitation's", async () => {
    const { s, inviter, nia, id } = await setup("lapse-equal-manage", "assistant_manager", "vm_manager");
    await db.update(member).set({ roleId: s.roles.vm_manager }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter was re-roled below the invitation's rank", async () => {
    const { s, inviter, nia, id } = await setup("lapse-below", "vm_manager", "vm_worker");
    await db.update(member).set({ roleId: s.roles.sales_associate }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter's role lost people.manage", async () => {
    const { s, nia, id } = await setup("lapse-switch", "vm_manager", "vm_worker");
    await db.update(roleDefinitions).set({ switches: ["view", "products.stock"] }).where(eq(roleDefinitions.id, s.roles.vm_manager));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the invitation's role was moved up to the inviter's rank", async () => {
    const { s, nia, id } = await setup("lapse-moved", "vm_manager", "vm_worker");
    await db.update(roleDefinitions).set({ rank: 299 }).where(eq(roleDefinitions.id, s.roles.vm_worker));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter's member row has no role", async () => {
    const { s, inviter, nia, id } = await setup("lapse-norole", "vm_manager", "vm_worker");
    await db.update(member).set({ roleId: null }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("holds when a Store Manager's role row lists no people.manage: it is locked on, as everywhere else", async () => {
    const { s, nia, id } = await setup("lapse-locked", "store_manager", "vm_worker");
    await db.update(roleDefinitions).set({ switches: ["view"] }).where(eq(roleDefinitions.id, s.roles.store_manager));
    expect((await acceptInvitation(nia, id)).status).toBe("accepted");
  });
});

describe("an inviter removed at the same moment as the accept", () => {
  // The accept and the removal race. Either order is fine, but the two must agree: the
  // person is in the store only if the accept ran before the removal took the inviter out.
  it("never leaves a half-written accept", async () => {
    for (let round = 0; round < 3; round += 1) {
      const { s, inviter, nia, id } = await setup(`lapse-race-${round}`, "vm_manager", "vm_worker");
      const remover = await actorIn(s, "store_manager");
      const target = (await readTarget(s.store, (await db.select({ id: member.id }).from(member).where(eq(member.userId, inviter.userId)))[0].id))!;
      const [accepted, removed] = await Promise.all([acceptInvitation(nia, id), applyRemoval(s.store, remover, target, s.roles.vm_manager)]);
      expect(removed.status).toBe("removed");
      expect(["accepted", "lapsed"]).toContain(accepted.status);
      const joined = (await membersOf(nia.id)).length;
      expect(joined).toBe(accepted.status === "accepted" ? 1 : 0);
      expect(await statusOf(id)).toBe(accepted.status === "accepted" ? "accepted" : "pending");
    }
  });
});
