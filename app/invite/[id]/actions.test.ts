// The real accept action against the dev database; only Better Auth's session and its
// setActiveOrganization are stood in. The person and their email come from the
// session, never from an argument, so someone cannot accept in another's name.

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), setActiveOrganization: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, setActiveOrganization: mocks.setActiveOrganization } } }));

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
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

  async function signInWithEmail(address: string) {
    const id = `test_acc_${randomUUID().slice(0, 8)}`;
    made.push(id);
    await db.insert(user).values({ id, name: "Nia Newcomer", email: address });
    mocks.getSession.mockResolvedValue({ user: { id, name: "Nia Newcomer", email: address }, session: { activeOrganizationId: null } });
    return id;
  }
  const membership = async (userId: string) => (await db.select().from(member).where(eq(member.userId, userId)))[0];

  it("answers signed-out and writes nothing when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await acceptInvitationAction(inviteId)).toEqual({ status: "signed-out" });
    expect((await db.select().from(invitation).where(eq(invitation.id, inviteId)))[0].status).toBe("pending");
    expect(mocks.setActiveOrganization).not.toHaveBeenCalled();
  });

  it("adds the signed-in person with the invited role, makes the store active for the session, and names it", async () => {
    const userId = await signInWithEmail(address);
    const out = await acceptInvitationAction(inviteId);
    expect(out).toMatchObject({ status: "accepted", roleName: "Visual Merchandising Worker" });
    expect(await membership(userId)).toMatchObject({ organizationId: store, roleId: roles.vm_worker });
    expect(mocks.setActiveOrganization).toHaveBeenCalledTimes(1);
    expect(mocks.setActiveOrganization.mock.calls[0][0].body).toEqual({ organizationId: store });
  });

  it("refuses someone signed in with another email, and never sets a store active", async () => {
    const userId = await signInWithEmail("someone.else@example.test");
    expect(await acceptInvitationAction(inviteId)).toEqual({ status: "wrong-email" });
    expect(await membership(userId)).toBeUndefined();
    expect(mocks.setActiveOrganization).not.toHaveBeenCalled();
  });

  it("still reports accepted when only making the store active failed (the next request picks the store)", async () => {
    const userId = await signInWithEmail(address);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.setActiveOrganization.mockRejectedValue(new Error("boom"));
    expect((await acceptInvitationAction(inviteId)).status).toBe("accepted");
    expect(await membership(userId)).toBeDefined();
    error.mockRestore();
  });

  it("answers invalid to an argument that is not an id", async () => {
    await signInWithEmail(address);
    for (const bad of [undefined, null, 42, "", {}, "x".repeat(300)]) expect(await acceptInvitationAction(bad)).toEqual({ status: "invalid" });
  });
});
