// The guards inside the write's own SQL, reached the way a race reaches them: the
// target is read, the row then changes under it, and the write runs with what was
// read. The pre-checks in changeRole and removePerson refuse these first when
// nothing moves in between, so only this sequencing tests the SQL predicates.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { applyRemoval, applyRoleChange, readTarget } from "./people-write";
import { actorIn, eventsOf, highRankIn, personIn, roleOf } from "./people-test";
import { dropPeople, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const setRole = (memberId: string, roleId: string) => db.update(member).set({ roleId }).where(eq(member.id, memberId));
/** What a concurrent Move up does: the role takes another rank (250 is free in a fresh store: the built-ins are 100 to 500). */
const liftTo250 = (roleId: string) => db.update(roleDefinitions).set({ rank: 250 }).where(eq(roleDefinitions.id, roleId));
const read = async (store: string, memberId: string) => (await readTarget(store, memberId))!;

describe("the write's own guards, after the pre-checks passed", () => {
  it("changes nothing when the person's role moved after it was read: stale, no event", async () => {
    const s = await makeStoreWithRoles("pr-stale-change");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await setRole(jane.memberId, s.roles.vm_worker);
    const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_manager, name: "Visual Merchandising Manager", rank: 300 });
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
    const out = await applyRoleChange(s.store, actor, target, first.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker", rank: 400 });
    expect(out).toEqual({ status: "stale" }); // the write matched nothing; reported as stale, not last-manager
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
    expect(await applyRemoval(s.store, actor, target, first.roleId)).toEqual({ status: "stale" });
    expect(await roleOf(first.memberId)).toBe(s.roles.store_manager);
    expect(await eventsOf(s.store)).toEqual([]);
  });
});

// A role can be moved up by someone else (roles screen, Move up) between the rank check and the
// write. The write pins each role to the rank the check saw, so a role that reached or passed the
// actor's rank meanwhile changes nothing (13b L1).
describe("the write's rank pins, after the rank check passed", () => {
  it("changes nothing when the target's role was moved up to the actor's reach after it was read", async () => {
    const s = await makeStoreWithRoles("pr-rank-target");
    const actor = await actorIn(s, "vm_manager"); // rank 300 may act on Sales Associate (500) only
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await liftTo250(s.roles.sales_associate);
    const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker", rank: 400 });
    expect(out).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.sales_associate);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("changes nothing when the role being given was moved up after it was read", async () => {
    const s = await makeStoreWithRoles("pr-rank-new");
    const actor = await actorIn(s, "vm_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await liftTo250(s.roles.vm_worker);
    const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker", rank: 400 });
    expect(out).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.sales_associate);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("removes nobody when their role was moved up after it was read", async () => {
    const s = await makeStoreWithRoles("pr-rank-remove");
    const actor = await actorIn(s, "vm_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await liftTo250(s.roles.sales_associate);
    expect(await applyRemoval(s.store, actor, target, jane.roleId)).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.sales_associate);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("still changes the role when no rank moved", async () => {
    const s = await makeStoreWithRoles("pr-rank-ok");
    const actor = await actorIn(s, "vm_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker", rank: 400 });
    expect(out).toMatchObject({ status: "changed" });
  });
});

// A role deleted after the check meets the pin (gone before the statement) or the composite foreign key
// (gone while it runs): either way the dialog is stale, never "Couldn't save" (13b L2).
describe("a role deleted meanwhile", () => {
  it("is stale when the role being given is gone before the write", async () => {
    const s = await makeStoreWithRoles("pr-fk-change");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    await db.delete(roleDefinitions).where(eq(roleDefinitions.id, s.roles.vm_worker));
    const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker", rank: 400 });
    expect(out).toEqual({ status: "stale" });
    expect(await roleOf(jane.memberId)).toBe(s.roles.sales_associate);
  });

  it("is stale, not a thrown error, when the database's foreign key refuses the write", async () => {
    const s = await makeStoreWithRoles("pr-fk-refused");
    const actor = await actorIn(s, "store_manager");
    const jane = await personIn(s, "sales_associate");
    const target = await read(s.store, jane.memberId);
    // The delete commits after the statement starts, so only the foreign key sees it; that cannot be timed, so the error is staged.
    const refused = Object.assign(new Error("update failed"), { cause: Object.assign(new Error("fk"), { constraint: "member_role_fk" }) });
    const execute = vi.spyOn(db, "execute").mockRejectedValueOnce(refused);
    try {
      const out = await applyRoleChange(s.store, actor, target, jane.roleId, { id: s.roles.vm_worker, name: "Visual Merchandising Worker", rank: 400 });
      expect(out).toEqual({ status: "stale" });
    } finally {
      execute.mockRestore();
    }
  });
});
