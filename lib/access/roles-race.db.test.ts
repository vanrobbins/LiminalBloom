// The guards inside each role write's own SQL, reached the way a race reaches them: the roles are read, then
// something changes under the read, then the write runs with what was read. The pre-checks in the public
// functions refuse most of these first when nothing moves in between, so only this sequencing tests the
// SQL predicates: the version pin, the nesting rule over the whole final state, the pins on the role list
// and the Store Manager stamp, and the nesting rule alone with the checks before it skipped (adding, moving and deleting are in roles-race-structure.db.test.ts). Each leaves the roles and the log untouched.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { applyRename, insertRole, swapRanks } from "./roles-structure";
import { applyChanges, type Planned } from "./roles-switches";
import { addCustom, byBuiltin, eventsOf, highRankIn, rolesOf, withOnly } from "./roles-test";
import { readSnapshot } from "./roles-write";
import { dropPeople, makeStoreWithRoles } from "./test-roles";
import type { Switch } from "./switches";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

type Setup = Awaited<ReturnType<typeof makeStoreWithRoles>>;

const actorOf = async (s: Setup) => withOnly(await highRankIn(s), "roles.manage", "products.sale", "products.stock", "planograms.draft");
const setSwitches = (id: string, switches: Switch[]) => db.update(roleDefinitions).set({ switches, version: sql`${roleDefinitions.version} + 1` }).where(eq(roleDefinitions.id, id));
/** The Worker turning products.sale off: fine while the Sales Associate below lacks it. */
const plan = (snapshot: Awaited<ReturnType<typeof readSnapshot>>): Planned[] => {
  const role = snapshot.roles.find((r) => r.builtin === "vm_worker")!;
  return [{ role, next: role.switches.filter((x) => x !== "products.sale"), name: role.name }];
};
const unchanged = async (s: Setup, before: Awaited<ReturnType<typeof rolesOf>>) => {
  expect(await rolesOf(s.store)).toEqual(before);
  expect(await eventsOf(s.store)).toEqual([]);
};

describe("saving switches: the SQL's own guards", () => {
  it("refuses the nesting a change under the read causes: the Sales Associate gained a permission the batch takes from the Worker", async () => {
    const s = await makeStoreWithRoles("race-nest");
    const snapshot = await readSnapshot(s.store);
    const sa = await byBuiltin(s.store, "sales_associate");
    await setSwitches(sa.id, ["view", "products.stock", "products.sale"]);
    const before = await rolesOf(s.store);
    const out = await applyChanges(s.store, await actorOf(s), snapshot, plan(snapshot), "role_switches_changed");
    expect("rows" in out && out.rows).toEqual([]);
    await unchanged(s, before);
  });

  it("refuses a role whose version moved after it was read", async () => {
    const s = await makeStoreWithRoles("race-version");
    const snapshot = await readSnapshot(s.store);
    const vmw = await byBuiltin(s.store, "vm_worker");
    await setSwitches(vmw.id, ["view", "products.stock", "products.sale", "planograms.draft"]);
    const before = await rolesOf(s.store);
    const out = await applyChanges(s.store, await actorOf(s), snapshot, plan(snapshot), "role_switches_changed");
    expect("rows" in out && out.rows).toEqual([]);
    await unchanged(s, before);
  });

  it("refuses when the roles are not the ones read: one was added, or the Store Manager row was touched", async () => {
    const s = await makeStoreWithRoles("race-pins");
    const snapshot = await readSnapshot(s.store);
    await db.update(roleDefinitions).set({ updatedAt: sql`now() + interval '1 second'` }).where(eq(roleDefinitions.id, (await byBuiltin(s.store, "store_manager")).id));
    let before = await rolesOf(s.store);
    expect(await applyChanges(s.store, await actorOf(s), snapshot, plan(snapshot), "role_switches_changed")).toEqual({ rows: [] });
    await unchanged(s, before);
    const fresh = await readSnapshot(s.store);
    await addCustom(s.store, "Late", 600, ["view"]);
    before = await rolesOf(s.store);
    expect(await applyChanges(s.store, await actorOf(s), fresh, plan(fresh), "role_switches_changed")).toEqual({ rows: [] });
    await unchanged(s, before);
  });
});

describe("the nesting rule in the SQL alone (the checks before it skipped)", () => {
  it("refuses a batch that turns a permission off above a role that still holds it, and one that adds a role above a role holding what it lacks", async () => {
    const s = await makeStoreWithRoles("race-sql-nest");
    const snapshot = await readSnapshot(s.store);
    const am = snapshot.roles.find((r) => r.builtin === "assistant_manager")!;
    // The Manager below still holds products.edit: only the "turned off above" clause of the rule can see this.
    const off: Planned[] = [{ role: am, next: am.switches.filter((x) => x !== "products.edit"), name: am.name }];
    expect(await applyChanges(s.store, await actorOf(s), snapshot, off, "role_switches_changed")).toEqual({ rows: [] });
    // On for a lower role while the one above lacks it: the Worker lacks layout.edit, so the Sales Associate can't gain it.
    const sa0 = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    const on: Planned[] = [{ role: sa0, next: [...sa0.switches, "layout.edit"], name: sa0.name }];
    expect(await applyChanges(s.store, await actorOf(s), snapshot, on, "role_switches_changed")).toEqual({ rows: [] });
    // A new role above the Sales Associate holding only view: the new role is the higher one.
    const sa = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    const vmw = snapshot.roles.find((r) => r.builtin === "vm_worker")!;
    const placed = { rank: 450, ranks: snapshot.roles.map((r) => ({ id: r.id, rank: r.rank })) };
    expect(await insertRole(s.store, await actorOf(s), snapshot, placed, "Over", ["view"])).toEqual({ status: "stale" });
    // Moving the Sales Associate's neighbour so the Worker sits below a role that lacks its permissions.
    const custom = await addCustom(s.store, "Planner", 550, ["view"]);
    const fresh = await readSnapshot(s.store);
    expect(await swapRanks(s.store, await actorOf(s), fresh, fresh.roles.find((r) => r.id === custom.id)!, fresh.roles.find((r) => r.id === sa.id)!, "up")).toEqual({ status: "stale" });
    expect(vmw.rank).toBe(400);
    expect(await rolesOf(s.store)).toHaveLength(6);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses a rename whose role changed after it was read", async () => {
    const s = await makeStoreWithRoles("race-rename");
    const snapshot = await readSnapshot(s.store);
    const sa = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    await setSwitches(sa.id, ["view"]);
    const before = await rolesOf(s.store);
    expect(await applyRename(s.store, await actorOf(s), sa, "Educator")).toEqual({ status: "stale" });
    await unchanged(s, before);
  });

  it("refuses a rename of a role that moved above the actor after it was read", async () => {
    const s = await makeStoreWithRoles("race-rename-rank");
    const custom = await addCustom(s.store, "Educator", 450, ["view"]);
    const actor = await actorOf(s);
    const role = (await readSnapshot(s.store)).roles.find((r) => r.id === custom.id)!;
    // Moved to a rank the actor no longer outranks; swapRanks does not bump the version, so only the rank pin can see it.
    await db.update(roleDefinitions).set({ rank: actor.rank - 1 }).where(eq(roleDefinitions.id, custom.id));
    const before = await rolesOf(s.store);
    expect(await applyRename(s.store, actor, role, "Planner")).toEqual({ status: "stale" });
    await unchanged(s, before);
  });
});

