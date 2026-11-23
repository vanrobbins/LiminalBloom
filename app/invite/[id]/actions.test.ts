// The real accept action against the dev database; only Better Auth's session is stood in,
// and the store is made active by the real setActiveStore on a real session row. The person and their email come from the
// session, never from an argument, so someone cannot accept in another's name.

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
// The real setActiveStore, which one test makes fail the way a dropped connection would.
const active = vi.hoisted(() => ({ fail: null as Error | null }));
vi.mock("@/lib/access/set-active-store", async (original) => {
  const real = await original<typeof import("@/lib/access/set-active-store")>();
  return {
    ...real,
    setActiveStore: async (...args: Parameters<typeof real.setActiveStore>) => {
      if (active.fail) throw active.fail;
      return real.setActiveStore(...args);
    },
  };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { eventsOf } from "@/lib/access/people-test";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import { makeSession, sessionStore } from "@/lib/access/test-session";
import { dropStores } from "@/lib/products/test-stores";

import { acceptInvitationAction } from "./actions";

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  for (const id of made.splice(0)) await db.delete(user).where(eq(user.id, id));
});

describe("acceptInvitationAction", () => {
  let store: string;
  let roles: StoreRoles;
  let inviteId: string;
  let address: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    address = `acc_${randomUUID().slice(0, 8)}@example.test`;
    ({ store, roles } = await makeStoreWithRoles("accept-action"));
    const inviter = await makePerson(store, roles.store_manager);
    inviteId = await makeInvitation(store, inviter.userId, roles.vm_worker);
    await db.update(invitation).set({ email: address }).where(eq(invitation.id, inviteId));
  });

  let sessionId = "";
  async function signInWithEmail(address: string) {
    const id = `test_acc_${randomUUID().slice(0, 8)}`;
    made.push(id);
    await db.insert(user).values({ id, name: "Nia Newcomer", email: address });
    sessionId = await makeSession(id);
    mocks.getSession.mockResolvedValue({ user: { id, name: "Nia Newcomer", email: address }, session: { id: sessionId, activeStoreId: null } });
    return id;
  }
  const membership = async (userId: string) => (await db.select().from(member).where(eq(member.userId, userId)))[0];

  it("answers signed-out and writes nothing when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await acceptInvitationAction(inviteId)).toEqual({ status: "signed-out" });
    expect((await db.select().from(invitation).where(eq(invitation.id, inviteId)))[0].status).toBe("pending");
  });

  it("adds the signed-in person with the invited role, makes the store active for the session, and names it", async () => {
    const userId = await signInWithEmail(address);
    const out = await acceptInvitationAction(inviteId);
    expect(out).toMatchObject({ status: "accepted", roleName: "Visual Merchandising Worker" });
    expect(await membership(userId)).toMatchObject({ organizationId: store, roleId: roles.vm_worker });
    expect(await sessionStore(sessionId)).toBe(store);
    expect((await db.select({ last: user.lastActiveStoreId }).from(user).where(eq(user.id, userId)))[0].last).toBe(store);
  });

  it("lets a person who still needs two-factor in their own store accept into one whose role does not require it (the requirement is per store and role)", async () => {
    const { store: home, roles: homeRoles } = await makeStoreWithRoles("accept-needs-2fa");
    const { userId } = await makePerson(home, homeRoles.store_manager);
    // Their Store Manager role requires two-factor and they have none: getCurrentMember would say needs-two-factor.
    await db.update(user).set({ twoFactorEnabled: false, email: address }).where(eq(user.id, userId));
    sessionId = await makeSession(userId, home);
    mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Test person", email: address }, session: { id: sessionId, activeStoreId: home } });
    expect(await acceptInvitationAction(inviteId)).toMatchObject({ status: "accepted", roleName: "Visual Merchandising Worker" });
    const stores = (await db.select().from(member).where(eq(member.userId, userId))).map((m) => m.organizationId);
    expect(stores.sort()).toEqual([home, store].sort());
    expect(await sessionStore(sessionId)).toBe(store);
  });

  it("refuses someone signed in with another email, and never sets a store active", async () => {
    const userId = await signInWithEmail("someone.else@example.test");
    expect(await acceptInvitationAction(inviteId)).toEqual({ status: "wrong-email" });
    expect(await membership(userId)).toBeUndefined();
    expect(await sessionStore(sessionId)).toBeNull();
  });

  it("still reports accepted when only making the store active failed (the next request picks the store)", async () => {
    const userId = await signInWithEmail(address);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    active.fail = new Error("boom");
    try {
      expect((await acceptInvitationAction(inviteId)).status).toBe("accepted");
      expect(await membership(userId)).toBeDefined();
    } finally {
      active.fail = null;
      error.mockRestore();
    }
  });

  it.each([
    ["an expired invitation", { expiresAt: new Date(Date.now() - 1000) }, "expired"],
    ["a cancelled one", { status: "canceled" }, "cancelled"],
    ["an already accepted one", { status: "accepted" }, "used"],
  ] as const)("passes on the state of %s and writes nothing", async (_name, change, status) => {
    const userId = await signInWithEmail(address);
    await db.update(invitation).set(change).where(eq(invitation.id, inviteId));
    expect((await acceptInvitationAction(inviteId)).status).toBe(status);
    expect(await membership(userId)).toBeUndefined();
    expect(await eventsOf(store)).toEqual([]);
    expect(await sessionStore(sessionId)).toBeNull();
  });

  it("adds one member and logs one event when the same invitation is accepted twice at once", async () => {
    const userId = await signInWithEmail(address);
    const outcomes = await Promise.all([acceptInvitationAction(inviteId), acceptInvitationAction(inviteId)]);
    expect(outcomes.filter((o) => o.status === "accepted")).toHaveLength(1);
    expect(await db.select().from(member).where(eq(member.userId, userId))).toHaveLength(1);
    expect((await eventsOf(store)).filter((e) => e.event === "invitation_accepted")).toHaveLength(1);
    expect(await sessionStore(sessionId)).toBe(store);
  });

  it("answers invalid to an argument that is not an id", async () => {
    await signInWithEmail(address);
    for (const bad of [undefined, null, 42, "", {}, "x".repeat(300)]) expect(await acceptInvitationAction(bad)).toEqual({ status: "invalid" });
  });
});
