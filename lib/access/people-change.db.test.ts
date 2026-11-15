// Change role against the dev database: the rank rule, the stale, gone, invalid and last-manager refusals, and that a change and its access_events row land together.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { changeRole, type PeopleActor } from "./people-write";
import { actorIn, eventsOf, highRankIn, personIn, roleOf } from "./people-test";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

describe("changeRole", () => {
  it("lets a Store Manager re-role a Sales Associate: the member row and one event, Better Auth's role untouched", async () => {
    const s = await makeStoreWithRoles("pw-change");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const out = await changeRole(s.store, actor, jane.memberId, jane.roleId, s.roles.vm_worker);
    expect(out).toEqual({ status: "changed", name: "Jane sales_associate", roleName: "Visual Merchandising Worker" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.vm_worker);
    expect((await db.select({ r: member.role }).from(member).where(eq(member.id, jane.memberId)))[0].r).toBe("member");
    const events = await eventsOf(s.store);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: actor.userId, actorName: actor.name, event: "member_role_changed" });
    expect(events[0].detail).toMatchObject({ person: "Jane sales_associate", from: "Sales Associate", to: "Visual Merchandising Worker" });
  });

  it.each([
    ["assistant_manager", "store_manager", "sales_associate"],
    ["assistant_manager", "assistant_manager", "sales_associate"],
    ["vm_manager", "vm_manager", "sales_associate"],
    ["vm_manager", "assistant_manager", "sales_associate"],
    ["vm_worker", "sales_associate", "vm_worker"],
    ["sales_associate", "sales_associate", "vm_worker"],
  ] as const)("refuses a %s acting on a %s, writing nothing", async (actorKey, targetKey, toKey) => {
    const s = await makeStoreWithRoles("pw-rank-target");
    const actor = await actorIn(s, actorKey);
    const target = await personIn(s, targetKey);
    expect(await changeRole(s.store, actor, target.memberId, target.roleId, s.roles[toKey])).toEqual({ status: "forbidden" });
    expect(await roleOf(target.memberId)).toBe(s.roles[targetKey]);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it.each([
    ["assistant_manager", "assistant_manager"],
    ["assistant_manager", "store_manager"],
    ["vm_manager", "vm_manager"],
    ["vm_manager", "assistant_manager"],
  ] as const)("refuses a %s giving someone the %s role (at or above their own)", async (actorKey, toKey) => {
    const s = await makeStoreWithRoles("pw-rank-new");
    const actor = await actorIn(s, actorKey);
    const target = await personIn(s, "sales_associate");
    expect(await changeRole(s.store, actor, target.memberId, target.roleId, s.roles[toKey])).toEqual({ status: "forbidden" });
    expect(await roleOf(target.memberId)).toBe(s.roles.sales_associate);
  });

  it("lets a VM Manager reach a VM Worker and a Sales Associate", async () => {
    const s = await makeStoreWithRoles("pw-vmm");
    const actor = await actorIn(s, "vm_manager");
    const worker = await personIn(s, "vm_worker");
    expect((await changeRole(s.store, actor, worker.memberId, worker.roleId, s.roles.sales_associate)).status).toBe("changed");
  });

  it("refuses someone without people.manage, even at a high rank, and refuses changing yourself", async () => {
    const s = await makeStoreWithRoles("pw-nomanage");
    const target = await personIn(s, "sales_associate");
    const actor: PeopleActor = { ...(await actorIn(s, "store_manager")), switches: new Set(["view"]) };
    expect(await changeRole(s.store, actor, target.memberId, target.roleId, s.roles.vm_worker)).toEqual({ status: "forbidden" });
    const mgr = await actorIn(s, "assistant_manager");
    const me = await db.select({ id: member.id, r: member.roleId }).from(member).where(eq(member.userId, mgr.userId));
    expect(await changeRole(s.store, mgr, me[0].id, me[0].r, s.roles.vm_worker)).toEqual({ status: "forbidden" });
  });

  it("says stale when the person's role changed since the dialog opened, and gone for a missing or foreign member", async () => {
    const s = await makeStoreWithRoles("pw-stale");
    const other = await makeStoreWithRoles("pw-stale-other");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    await db.update(member).set({ roleId: s.roles.vm_worker }).where(eq(member.id, jane.memberId));
    expect(await changeRole(s.store, actor, jane.memberId, jane.roleId, s.roles.vm_manager)).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.vm_worker);
    expect(await changeRole(s.store, actor, "no-such-member", null, s.roles.vm_worker)).toEqual({ status: "gone" });
    const stranger = await personIn(other, "sales_associate");
    expect(await changeRole(s.store, actor, stranger.memberId, stranger.roleId, s.roles.vm_worker)).toEqual({ status: "gone" });
    expect(await roleOf(stranger.memberId)).toBe(other.roles.sales_associate);
  });

  it("is invalid for a role from another store, a role that does not exist, or the role they already hold", async () => {
    const s = await makeStoreWithRoles("pw-invalid");
    const other = await makeStoreWithRoles("pw-invalid-other");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    for (const to of [other.roles.vm_worker, "no-such-role", jane.roleId]) {
      expect(await changeRole(s.store, actor, jane.memberId, jane.roleId, to)).toEqual({ status: "invalid" });
    }
    expect(await roleOf(jane.memberId)).toBe(s.roles.sales_associate);
  });

  it("reaches a member with no role, which ranks below every role", async () => {
    const s = await makeStoreWithRoles("pw-norole");
    const actor = await actorIn(s, "vm_manager");
    const { memberId } = await makePerson(s.store, null);
    expect((await changeRole(s.store, actor, memberId, null, s.roles.sales_associate)).status).toBe("changed");
  });

  it("refuses to take the last Store Manager out of the role, and allows it when there are two", async () => {
    const s = await makeStoreWithRoles("pw-last");
    const above = await highRankIn(s);
    const only = await personIn(s, "store_manager");
    expect(await changeRole(s.store, above, only.memberId, only.roleId, s.roles.vm_worker)).toEqual({ status: "last-manager" });
    expect(await roleOf(only.memberId)).toBe(s.roles.store_manager);
    const second = await personIn(s, "store_manager");
    expect((await changeRole(s.store, above, second.memberId, second.roleId, s.roles.vm_worker)).status).toBe("changed");
  });
});
