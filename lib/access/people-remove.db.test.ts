// Remove a person against the dev database: the rank rule, stale, gone and last-manager refusals, and the event written with the removal.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { removePerson } from "./people-write";
import { actorIn, eventsOf, highRankIn, personIn, roleOf } from "./people-test";
import { dropPeople, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

describe("removePerson", () => {
  it("removes the member and writes the event; the account stays; a second removal says gone", async () => {
    const s = await makeStoreWithRoles("pw-remove");
    const actor = await actorIn(s, "vm_manager");
    const jane = await personIn(s, "sales_associate");
    expect(await removePerson(s.store, actor, jane.memberId, jane.roleId)).toEqual({ status: "removed", name: "Jane sales_associate" });
    expect(await roleOf(jane.memberId)).toBeUndefined();
    expect(await db.select().from(user).where(eq(user.id, jane.userId))).toHaveLength(1);
    const events = await eventsOf(s.store);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: actor.userId, event: "member_removed" });
    expect(events[0].detail).toMatchObject({ person: "Jane sales_associate", role: "Sales Associate" });
    expect(await removePerson(s.store, actor, jane.memberId, jane.roleId)).toEqual({ status: "gone" });
    expect(await eventsOf(s.store)).toHaveLength(1);
  });

  it.each([
    ["assistant_manager", "store_manager"],
    ["assistant_manager", "assistant_manager"],
    ["vm_manager", "vm_manager"],
    ["vm_worker", "sales_associate"],
  ] as const)("refuses a %s removing a %s", async (actorKey, targetKey) => {
    const s = await makeStoreWithRoles("pw-remove-rank");
    const actor = await actorIn(s, actorKey);
    const target = await personIn(s, targetKey);
    expect(await removePerson(s.store, actor, target.memberId, target.roleId)).toEqual({ status: "forbidden" });
    expect(await roleOf(target.memberId)).toBe(s.roles[targetKey]);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses removing yourself, says stale for a changed role, gone for another store's member", async () => {
    const s = await makeStoreWithRoles("pw-remove-misc");
    const other = await makeStoreWithRoles("pw-remove-misc-other");
    const actor = await actorIn(s, "store_manager");
    const me = (await db.select({ id: member.id }).from(member).where(eq(member.userId, actor.userId)))[0];
    expect(await removePerson(s.store, actor, me.id, s.roles.store_manager)).toEqual({ status: "forbidden" });
    const jane = await personIn(s, "sales_associate");
    expect(await removePerson(s.store, actor, jane.memberId, s.roles.vm_worker)).toEqual({ status: "stale" });
    const stranger = await personIn(other, "sales_associate");
    expect(await removePerson(s.store, actor, stranger.memberId, stranger.roleId)).toEqual({ status: "gone" });
    expect(await roleOf(stranger.memberId)).toBe(other.roles.sales_associate);
  });

  it("refuses removing the last Store Manager, and allows it when there are two", async () => {
    const s = await makeStoreWithRoles("pw-remove-last");
    const above = await highRankIn(s);
    const only = await personIn(s, "store_manager");
    expect(await removePerson(s.store, above, only.memberId, only.roleId)).toEqual({ status: "last-manager" });
    expect(await roleOf(only.memberId)).toBe(s.roles.store_manager);
    const second = await personIn(s, "store_manager");
    expect((await removePerson(s.store, above, second.memberId, second.roleId)).status).toBe("removed");
  });
});
