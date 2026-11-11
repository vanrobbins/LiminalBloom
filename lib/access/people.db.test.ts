// What each kind of viewer is given for the People screen, from the dev database:
// emails and invitations only for someone who may manage people, buttons only on
// rows the rank rule allows, and nothing from another store.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, user } from "@/db/auth-schema";
import type { Member } from "@/lib/current-member";
import { dropStores } from "@/lib/products/test-stores";

import { peopleViewFor } from "./people";
import { BUILTIN_ROLES, type BuiltinRoleKey } from "./roles";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles, type StoreRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

async function named(store: string, roleId: string | null, name: string) {
  const person = await makePerson(store, roleId);
  await db.update(user).set({ name }).where(eq(user.id, person.userId));
  return person;
}

/** A real person in the store, as the guard would hand them to the page. */
async function viewerIn(store: string, roles: StoreRoles, key: BuiltinRoleKey, name = `Viewer ${key}`): Promise<Member> {
  const { userId } = await named(store, roles[key], name);
  const def = BUILTIN_ROLES.find((r) => r.key === key)!;
  return { kind: "member", user: { id: userId, name, email: `${userId}@example.com` }, stores: [], activeStoreId: store, role: { id: roles[key], name: def.name, rank: def.rank }, switches: [...def.switches] };
}

async function crowd(label: string) {
  const s = await makeStoreWithRoles(label);
  await named(s.store, s.roles.store_manager, "Sam Manager");
  await named(s.store, s.roles.assistant_manager, "Ann Assistant");
  await named(s.store, s.roles.vm_manager, "Vic Manager");
  await named(s.store, s.roles.vm_worker, "Wes Worker");
  await named(s.store, s.roles.sales_associate, "Zoe Sales");
  await named(s.store, s.roles.sales_associate, "Abe Sales");
  return s;
}

const acting = (view: Awaited<ReturnType<typeof peopleViewFor>>) =>
  view.groups.flatMap((g) => g.people).filter((p) => p.canAct).map((p) => p.name).sort();

describe("peopleViewFor", () => {
  it("groups by role, highest first, names A to Z, with the viewer marked", async () => {
    const s = await crowd("pv-groups");
    const view = await peopleViewFor(await viewerIn(s.store, s.roles, "sales_associate", "Mia Me"));
    expect(view.groups.map((g) => g.roleName)).toEqual(["Store Manager", "Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
    expect(view.groups[4].people.map((p) => p.name)).toEqual(["Abe Sales", "Mia Me", "Zoe Sales"]);
    expect(view.groups.flatMap((g) => g.people).filter((p) => p.isYou).map((p) => p.name)).toEqual(["Mia Me"]);
  });

  it.each(["vm_worker", "sales_associate"] as const)("gives a %s names and roles only: no emails, invitations, assignable roles or buttons", async (key) => {
    const s = await crowd(`pv-readonly-${key}`);
    await makeInvitation(s.store, (await viewerIn(s.store, s.roles, "store_manager")).user.id, s.roles.sales_associate);
    const view = await peopleViewFor(await viewerIn(s.store, s.roles, key));
    expect(view.canManage).toBe(false);
    expect(view.groups.flatMap((g) => g.people).every((p) => p.email === null && !p.canAct)).toBe(true);
    expect(view.invitations).toEqual([]);
    expect(view.assignable).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("@");
  });

  it("offers a Store Manager every row below Store Manager, and no Store Manager row, and shows emails", async () => {
    const s = await crowd("pv-sm");
    const view = await peopleViewFor(await viewerIn(s.store, s.roles, "store_manager", "Me Manager"));
    expect(acting(view)).toEqual(["Abe Sales", "Ann Assistant", "Vic Manager", "Wes Worker", "Zoe Sales"]);
    expect(view.groups.flatMap((g) => g.people).every((p) => p.email?.includes("@"))).toBe(true);
    expect(view.assignable.map((r) => r.name)).toEqual(BUILTIN_ROLES.slice(1).map((r) => r.name));
    expect(view.isSoleManager).toBe(false);
  });

  it("offers an Assistant Manager nobody at or above their rank, and a VM Manager only the two lowest", async () => {
    const s = await crowd("pv-am");
    expect(acting(await peopleViewFor(await viewerIn(s.store, s.roles, "assistant_manager")))).toEqual(["Abe Sales", "Vic Manager", "Wes Worker", "Zoe Sales"]);
    const vmm = await peopleViewFor(await viewerIn(s.store, s.roles, "vm_manager"));
    expect(acting(vmm)).toEqual(["Abe Sales", "Wes Worker", "Zoe Sales"]);
    expect(vmm.assignable.map((r) => r.name)).toEqual(["Visual Merchandising Worker", "Sales Associate"]);
  });

  it("lists pending invitations for a manager only, with the rank rule applied, and marks expired ones", async () => {
    const s = await makeStoreWithRoles("pv-inv");
    const vmm = await viewerIn(s.store, s.roles, "vm_manager");
    const low = await makeInvitation(s.store, vmm.user.id, s.roles.sales_associate);
    await makeInvitation(s.store, vmm.user.id, s.roles.assistant_manager);
    const done = await makeInvitation(s.store, vmm.user.id, s.roles.sales_associate);
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, done));
    await db.update(invitation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitation.id, low));
    const view = await peopleViewFor(vmm);
    expect(view.invitations).toHaveLength(2);
    const byRole = Object.fromEntries(view.invitations.map((i) => [i.roleName, i]));
    expect(byRole["Sales Associate"]).toMatchObject({ canAct: true, expired: true });
    expect(byRole["Assistant Manager"]).toMatchObject({ canAct: false, expired: false });
  });

  it("never sends the id of an invitation the viewer can't act on: the id is the link", async () => {
    const s = await makeStoreWithRoles("pv-inv-id");
    const vmm = await viewerIn(s.store, s.roles, "vm_manager");
    const mine = await makeInvitation(s.store, vmm.user.id, s.roles.sales_associate);
    const above = await makeInvitation(s.store, vmm.user.id, s.roles.assistant_manager);
    await db.update(invitation).set({ email: "boss@example.com" }).where(eq(invitation.id, above)); // the helper's address contains the id
    const view = await peopleViewFor(vmm);
    // What the page hands the client is this object, serialised.
    const sent = JSON.stringify(view);
    expect(sent).toContain(mine);
    expect(sent).not.toContain(above);
    expect(view.invitations.find((i) => i.roleName === "Assistant Manager")).toMatchObject({ canAct: false, id: null });
  });

  it("is only this store, and says so when the viewer is the sole Store Manager or has no role", async () => {
    const s = await makeStoreWithRoles("pv-sole");
    await makeStoreWithRoles("pv-sole-other");
    const me = await viewerIn(s.store, s.roles, "store_manager");
    const view = await peopleViewFor(me);
    expect(view.groups.flatMap((g) => g.people)).toHaveLength(1);
    expect(view.isSoleManager).toBe(true);
    const lone = await named(s.store, null, "No Role Nora");
    const roleless: Member = { ...me, user: { ...me.user, id: lone.userId }, role: null, switches: ["view"] };
    const seen = await peopleViewFor(roleless);
    expect(seen.groups.at(-1)).toMatchObject({ roleName: "No role" });
    expect(acting(seen)).toEqual([]);
  });
});
