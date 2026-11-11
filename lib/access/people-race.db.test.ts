// The guards inside the write's own SQL, reached the way a race reaches them: the
// target is read, the row then changes under it, and the write runs with what was
// read. The pre-checks in changeRole and removePerson refuse these first when
// nothing moves in between, so only this sequencing tests the SQL predicates.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { applyRemoval, applyRoleChange, readTarget } from "./people-write";
import { actorIn, eventsOf, highRankIn, personIn, roleOf } from "./people-test";
import { dropPeople, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const setRole = (memberId: string, roleId: string) => db.update(member).set({ roleId }).where(eq(member.id, memberId));
const read = async (store: string, memberId: string) => (await readTarget(store, memberId))!;

describe("the write's own guards, after the pre-checks passed", () => {
  it("changes nothing when the person's role moved after it was read: stale, no event", async () => {
    const s = await makeStoreWithRoles("pr-stale-change");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await setRole(jane.memberId, s.roles.vm_worker);
    const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_manager, name: "Visual Merchandising Manager" });
    expect(out).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.vm_worker);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("removes nobody when the person's role moved after it was read: stale, still a member, no event", async () => {
    const s = await makeStoreWithRoles("pr-stale-remove");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await setRole(jane.memberId, s.roles.vm_worker);
    expect(await applyRemoval(s.store, actor, target, jane.roleId)).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.vm_worker);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("says gone, not stale, when the person left after they were read", async () => {
    const s = await makeStoreWithRoles("pr-gone");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await db.delete(member).where(eq(member.id, jane.memberId));
    expect(await applyRemoval(s.store, actor, target, jane.roleId)).toEqual({ status: "gone" });
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("keeps the last Store Manager when the other one was demoted after the read: role change", async () => {
    const s = await makeStoreWithRoles("pr-last-change");
    const actor = await highRankIn(s); // not a Store Manager themselves, so the count is only the two
    const first = await personIn(s, "store_manager");
    const second = await personIn(s, "store_manager");
    const target = await read(s.store, first.memberId); // two managers when read
    await setRole(second.memberId, s.roles.vm_worker); // the other is demoted meanwhile
    const out = await applyRoleChange(s.store, actor, target, first.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker" });
    expect(out.status).not.toBe("changed");
    expect(await roleOf(first.memberId)).toBe(s.roles.store_manager);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("keeps the last Store Manager when the other one was demoted after the read: removal", async () => {
    const s = await makeStoreWithRoles("pr-last-remove");
    const actor = await highRankIn(s); // not a Store Manager themselves, so the count is only the two
    const first = await personIn(s, "store_manager");
    const second = await personIn(s, "store_manager");
    const target = await read(s.store, first.memberId);
    await setRole(second.memberId, s.roles.vm_worker);
    expect((await applyRemoval(s.store, actor, target, first.roleId)).status).not.toBe("removed");
    expect(await roleOf(first.memberId)).toBe(s.roles.store_manager);
    expect(await eventsOf(s.store)).toEqual([]);
  });
});
