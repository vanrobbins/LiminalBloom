// The real actions with the real current-member and resolveAccess against the dev
// database: only Better Auth's session is stood in for. Every refusal must come
// back from the action itself, because a person can call it with the buttons hidden.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listOrganizations: mocks.listOrganizations } } }));

import { db } from "@/db";
import { invitation, member } from "@/db/auth-schema";
import { accessEvents } from "@/db/schema";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { cancelInvitationAction, changeRoleAction, createInvitationAction, removePersonAction } from "./people-actions";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

describe("people actions", () => {
  let store: string;
  let roles: StoreRoles;

  beforeEach(async () => {
    ({ store, roles } = await makeStoreWithRoles("people-action"));
  });

  /** Signs in a new person holding the role (a key of StoreRoles), or none, working in the store. */
  async function signInAs(role: keyof StoreRoles | null) {
    const { userId } = await makePerson(store, role ? roles[role] : null);
    mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Van", email: `${userId}@example.com` }, session: { activeOrganizationId: store } });
    mocks.listOrganizations.mockResolvedValue([{ id: store, name: "Test" }]);
    return userId;
  }
  const roleOf = async (memberId: string) => (await db.select({ r: member.roleId }).from(member).where(eq(member.id, memberId)))[0]?.r;
  const eventCount = async () => (await db.select().from(accessEvents).where(eq(accessEvents.storeId, store))).length;

  it("changes, removes and cancels for a Store Manager, each with its event", async () => {
    const manager = await signInAs("store_manager");
    const jane = await makePerson(store, roles.sales_associate);
    const joe = await makePerson(store, roles.vm_worker);
    const invite = await makeInvitation(store, manager, roles.sales_associate);
    expect((await changeRoleAction(jane.memberId, roles.sales_associate, roles.vm_worker)).status).toBe("changed");
    expect(await roleOf(jane.memberId)).toBe(roles.vm_worker);
    expect((await removePersonAction(joe.memberId, roles.vm_worker)).status).toBe("removed");
    expect((await cancelInvitationAction(invite)).status).toBe("cancelled");
    expect(await eventCount()).toBe(3);
  });

  it.each(["vm_worker", "sales_associate", null] as const)("refuses a member whose role is %s, in all three, and changes nothing", async (role) => {
    const jane = await makePerson(store, roles.sales_associate);
    const invite = await makeInvitation(store, jane.userId, roles.sales_associate);
    await signInAs(role);
    expect(await changeRoleAction(jane.memberId, roles.sales_associate, roles.vm_worker)).toEqual({ status: "forbidden" });
    expect(await removePersonAction(jane.memberId, roles.sales_associate)).toEqual({ status: "forbidden" });
    expect(await cancelInvitationAction(invite)).toEqual({ status: "forbidden" });
    expect(await roleOf(jane.memberId)).toBe(roles.sales_associate);
    expect((await db.select().from(invitation).where(eq(invitation.id, invite)))[0].status).toBe("pending");
    expect(await eventCount()).toBe(0);
  });

  it("holds the rank rule for an Assistant Manager and a VM Manager even when called directly", async () => {
    const sm = await makePerson(store, roles.store_manager);
    const am = await makePerson(store, roles.assistant_manager);
    const sales = await makePerson(store, roles.sales_associate);
    await signInAs("assistant_manager");
    expect(await changeRoleAction(sm.memberId, roles.store_manager, roles.sales_associate)).toEqual({ status: "forbidden" });
    expect(await removePersonAction(am.memberId, roles.assistant_manager)).toEqual({ status: "forbidden" });
    expect(await changeRoleAction(sales.memberId, roles.sales_associate, roles.assistant_manager)).toEqual({ status: "forbidden" });
    await signInAs("vm_manager");
    expect(await changeRoleAction(am.memberId, roles.assistant_manager, roles.sales_associate)).toEqual({ status: "forbidden" });
    expect(await changeRoleAction(sales.memberId, roles.sales_associate, roles.vm_manager)).toEqual({ status: "forbidden" });
    expect(await roleOf(sm.memberId)).toBe(roles.store_manager);
    expect(await roleOf(am.memberId)).toBe(roles.assistant_manager);
    expect(await roleOf(sales.memberId)).toBe(roles.sales_associate);
    expect(await eventCount()).toBe(0);
  });

  it("refuses a Store Manager changing or removing themselves, and answers stale and gone in words the screen maps", async () => {
    const userId = await signInAs("store_manager");
    const me = (await db.select({ id: member.id }).from(member).where(eq(member.userId, userId)))[0];
    expect(await removePersonAction(me.id, roles.store_manager)).toEqual({ status: "forbidden" });
    expect(await changeRoleAction(me.id, roles.store_manager, roles.vm_worker)).toEqual({ status: "forbidden" });
    const jane = await makePerson(store, roles.sales_associate);
    expect(await changeRoleAction(jane.memberId, roles.vm_worker, roles.vm_manager)).toEqual({ status: "stale" });
    await removePersonAction(jane.memberId, roles.sales_associate);
    expect(await removePersonAction(jane.memberId, roles.sales_associate)).toEqual({ status: "gone" });
    expect(await cancelInvitationAction("no-such-invitation")).toEqual({ status: "gone" });
  });

  it("creates an invitation for a Store Manager, with its event and the link's id, and the expiry as text", async () => {
    await signInAs("store_manager");
    const out = await createInvitationAction("Jane@Example.Test", roles.vm_worker);
    expect(out).toMatchObject({ status: "created", email: "jane@example.test", roleName: "Visual Merchandising Worker" });
    if (out.status !== "created") throw new Error("not created");
    expect(typeof out.expiresAt).toBe("string");
    expect((await db.select().from(invitation).where(eq(invitation.id, out.id)))[0]).toMatchObject({ status: "pending", roleId: roles.vm_worker });
    expect(await eventCount()).toBe(1);
  });

  it.each(["vm_worker", "sales_associate", null] as const)("refuses to invite for a member whose role is %s, and writes nothing", async (role) => {
    await signInAs(role);
    expect(await createInvitationAction("jane@example.test", roles.sales_associate)).toEqual({ status: "forbidden" });
    expect(await db.select().from(invitation).where(eq(invitation.organizationId, store))).toEqual([]);
    expect(await eventCount()).toBe(0);
  });

  it("holds the rank rule on the role invited into, even when called directly", async () => {
    await signInAs("assistant_manager");
    expect(await createInvitationAction("a@example.test", roles.store_manager)).toEqual({ status: "forbidden" });
    expect(await createInvitationAction("a@example.test", roles.assistant_manager)).toEqual({ status: "forbidden" });
    await signInAs("vm_manager");
    expect(await createInvitationAction("a@example.test", roles.vm_manager)).toEqual({ status: "forbidden" });
    expect((await createInvitationAction("a@example.test", roles.vm_worker)).status).toBe("created");
    expect(await eventCount()).toBe(1);
  });

  it("answers invalid to arguments that are not text, and bad-email to a blank address", async () => {
    await signInAs("store_manager");
    for (const bad of [undefined, null, 42, {}, "x".repeat(400)]) expect(await createInvitationAction(bad, roles.vm_worker)).toEqual({ status: "invalid" });
    for (const bad of [undefined, null, 42, {}, "x".repeat(300)]) expect(await createInvitationAction("a@example.test", bad)).toEqual({ status: "invalid" });
    expect(await createInvitationAction("", roles.vm_worker)).toEqual({ status: "bad-email" });
    expect(await eventCount()).toBe(0);
  });

  it("answers invalid, not an error, to arguments that are not ids", async () => {
    await signInAs("store_manager");
    for (const bad of [undefined, null, 42, "", {}, "x".repeat(300)]) {
      expect(await changeRoleAction(bad, null, bad)).toEqual({ status: "invalid" });
      expect(await removePersonAction(bad, null)).toEqual({ status: "invalid" });
      expect(await cancelInvitationAction(bad)).toEqual({ status: "invalid" });
    }
    expect(await removePersonAction("m", 7)).toEqual({ status: "invalid" });
    expect(await eventCount()).toBe(0);
  });
});
