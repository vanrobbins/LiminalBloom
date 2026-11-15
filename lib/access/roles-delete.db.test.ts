// Deleting a custom role against the dev database: with nobody, and with people (members and pending
// invitations moved in the same statement, one event per person), the people.manage and rank rules,
// built-ins refused, and the pins (version, the count the person saw).

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { deleteRole } from "./roles-delete";
import { actorIn, addCustom, byBuiltin, eventsOf, highRankIn, rolesOf, roleOf, withOnly } from "./roles-test";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

type Setup = Awaited<ReturnType<typeof makeStoreWithRoles>>;
const WORKER = ["view", "products.stock", "products.sale", "planograms.draft"] as const;

async function withEducator(label: string) {
  const s: Setup = await makeStoreWithRoles(label);
  const role = await addCustom(s.store, "Educator", 450, [...WORKER]);
  return { s, role };
}
const input = (role: { id: string; version: number }, moveToId: string | null, members = 0, invitations = 0) => ({ roleId: role.id, version: role.version, moveToId, members, invitations });

describe("deleteRole", () => {
  it("deletes a role nobody holds, logging role_deleted", async () => {
    const { s, role } = await withEducator("dr-empty");
    const actor = await actorIn(s, "assistant_manager");
    expect(await deleteRole(s.store, actor, input(role, null))).toEqual({ status: "deleted", name: "Educator", moved: 0, movedTo: null });
    expect((await rolesOf(s.store)).map((r) => r.name)).not.toContain("Educator");
    expect((await eventsOf(s.store)).map((e) => e.event)).toEqual(["role_deleted"]);
  });

  it("moves members and pending invitations in the same statement: an event per person, one for the role, old invitations unlinked", async () => {
    const { s, role } = await withEducator("dr-people");
    const actor = await actorIn(s, "assistant_manager");
    const a = await makePerson(s.store, role.id);
    const b = await makePerson(s.store, role.id);
    const pending = await makeInvitation(s.store, a.userId, role.id);
    const old = await makeInvitation(s.store, a.userId, role.id);
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, old));
    const bystander = await makePerson(s.store, s.roles.vm_worker);
    const out = await deleteRole(s.store, actor, input(role, s.roles.sales_associate, 2, 1));
    expect(out).toEqual({ status: "deleted", name: "Educator", moved: 3, movedTo: "Sales Associate" });
    expect([await roleOf(a.memberId), await roleOf(b.memberId)]).toEqual([s.roles.sales_associate, s.roles.sales_associate]);
    expect(await roleOf(bystander.memberId)).toBe(s.roles.vm_worker);
    const [p] = await db.select().from(invitation).where(eq(invitation.id, pending));
    expect(p.roleId).toBe(s.roles.sales_associate);
    expect((await db.select().from(invitation).where(eq(invitation.id, old)))[0].roleId).toBeNull();
    const events = await eventsOf(s.store);
    expect(events.filter((e) => e.event === "member_role_changed")).toHaveLength(2);
    expect(events.find((e) => e.event === "role_deleted")?.detail).toMatchObject({ role: "Educator", movedTo: "Sales Associate", people: 2, invitations: 1 });
    expect(await db.select().from(member).where(eq(member.roleId, role.id))).toEqual([]);
  });

  it("refuses to delete a built-in role", async () => {
    const s = await makeStoreWithRoles("dr-builtin");
    const actor = await actorIn(s, "assistant_manager");
    const sa = await byBuiltin(s.store, "sales_associate");
    expect(await deleteRole(s.store, actor, input(sa, null))).toEqual({ status: "invalid" });
    expect(await rolesOf(s.store)).toHaveLength(5);
  });

  it("needs people.manage to move people, but not to delete an empty role", async () => {
    const { s, role } = await withEducator("dr-nopeople");
    const actor = withOnly(await highRankIn(s), "roles.manage");
    const a = await makePerson(s.store, role.id);
    expect(await deleteRole(s.store, actor, input(role, s.roles.sales_associate, 1, 0))).toEqual({ status: "cant-move-people" });
    expect(await roleOf(a.memberId)).toBe(role.id);
    await db.delete(member).where(eq(member.id, a.memberId));
    expect((await deleteRole(s.store, actor, input(role, null))).status).toBe("deleted");
  });

  it("refuses a destination that is missing, is the role itself, or isn't below the actor", async () => {
    const { s, role } = await withEducator("dr-dest");
    const actor = await actorIn(s, "assistant_manager");
    const a = await makePerson(s.store, role.id);
    const vmm = await actorIn(s, "vm_manager");
    expect(await deleteRole(s.store, actor, input(role, null, 1))).toEqual({ status: "invalid" });
    expect(await deleteRole(s.store, actor, input(role, role.id, 1))).toEqual({ status: "invalid" });
    expect(await deleteRole(s.store, actor, input(role, "nope", 1))).toEqual({ status: "invalid" });
    expect(await deleteRole(s.store, actor, input(role, s.roles.assistant_manager, 1))).toEqual({ status: "rank" });
    expect(await deleteRole(s.store, actor, input(role, s.roles.store_manager, 1))).toEqual({ status: "rank" });
    // A VM Manager can move people but doesn't hold roles.manage, so the role itself is out of reach.
    expect(await deleteRole(s.store, vmm, input(role, s.roles.sales_associate, 1))).toEqual({ status: "forbidden" });
    expect(await roleOf(a.memberId)).toBe(role.id);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refreshes instead of moving unseen people: someone joined or left since the dialog, and an invitation arrived", async () => {
    const { s, role } = await withEducator("dr-changed");
    const actor = await actorIn(s, "assistant_manager");
    const a = await makePerson(s.store, role.id);
    const late = await makePerson(s.store, role.id);
    const out = await deleteRole(s.store, actor, input(role, s.roles.sales_associate, 1, 0));
    expect(out).toMatchObject({ status: "people-changed", invitations: 0 });
    expect(out.status === "people-changed" && out.names).toHaveLength(2);
    await db.delete(member).where(eq(member.id, late.memberId));
    await makeInvitation(s.store, a.userId, role.id);
    expect(await deleteRole(s.store, actor, input(role, s.roles.sales_associate, 1, 0))).toMatchObject({ status: "people-changed", invitations: 1 });
    expect(await roleOf(a.memberId)).toBe(role.id);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses a stale version and a role already gone", async () => {
    const { s, role } = await withEducator("dr-stale");
    const actor = await actorIn(s, "assistant_manager");
    expect(await deleteRole(s.store, actor, { ...input(role, null), version: role.version + 1 })).toEqual({ status: "stale" });
    expect(await deleteRole(s.store, actor, input(role, null))).toMatchObject({ status: "deleted" });
    expect(await deleteRole(s.store, actor, input(role, null))).toEqual({ status: "gone" });
  });
});
