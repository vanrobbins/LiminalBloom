// The guards inside the add, move and delete SQL, reached as in roles-race.db.test.ts: the roles are read, something
// changes under the read, then the write runs with what was read. The pins on the role list and the Store Manager
// stamp, the nesting rule, the order of the swapped roles, and the delete's counts and version.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { applyDelete } from "./roles-delete";
import { insertRole, swapRanks } from "./roles-structure";
import { addCustom, byBuiltin, eventsOf, highRankIn, rolesOf, roleOf, withOnly } from "./roles-test";
import { readSnapshot } from "./roles-write";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";
import type { Switch } from "./switches";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

type Setup = Awaited<ReturnType<typeof makeStoreWithRoles>>;
const WORKER: Switch[] = ["view", "products.stock", "products.sale", "planograms.draft"];

const actorOf = async (s: Setup) => withOnly(await highRankIn(s), "roles.manage", "products.sale", "products.stock", "planograms.draft");
const setSwitches = (id: string, switches: Switch[]) => db.update(roleDefinitions).set({ switches, version: sql`${roleDefinitions.version} + 1` }).where(eq(roleDefinitions.id, id));
const unchanged = async (s: Setup, before: Awaited<ReturnType<typeof rolesOf>>) => {
  expect(await rolesOf(s.store)).toEqual(before);
  expect(await eventsOf(s.store)).toEqual([]);
};

describe("adding, moving and deleting: the SQL's own guards", () => {
  it("add: refuses when the Store Manager stamp moved, or a role was added, since the read", async () => {
    const s = await makeStoreWithRoles("race-add");
    const snapshot = await readSnapshot(s.store);
    const sa = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    const placed = { rank: 600, ranks: snapshot.roles.map((r) => ({ id: r.id, rank: r.rank })) };
    await db.update(roleDefinitions).set({ updatedAt: sql`now() + interval '1 second'` }).where(eq(roleDefinitions.id, (await byBuiltin(s.store, "store_manager")).id));
    const before = await rolesOf(s.store);
    expect(await insertRole(s.store, await actorOf(s), snapshot, placed, "Late", ["view"])).toEqual({ status: "stale" });
    await unchanged(s, before);
    const fresh = await readSnapshot(s.store);
    await addCustom(s.store, "Other", 700, ["view"]);
    expect(await insertRole(s.store, await actorOf(s), fresh, { rank: 600, ranks: fresh.roles.map((r) => ({ id: r.id, rank: r.rank })) }, "Late", ["view"])).toEqual({ status: "stale" });
    expect(sa.rank).toBe(500);
  });

  it("add: refuses the nesting a change under the read causes", async () => {
    const s = await makeStoreWithRoles("race-add-nest");
    const snapshot = await readSnapshot(s.store);
    const sa = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    const placed = { rank: 600, ranks: snapshot.roles.map((r) => ({ id: r.id, rank: r.rank })) };
    // The new role would hold stock, which the Sales Associate above it held at read time and now lacks.
    await setSwitches(sa.id, ["view"]);
    const before = await rolesOf(s.store);
    expect(await insertRole(s.store, await actorOf(s), snapshot, placed, "Late", ["view", "products.stock"])).toEqual({ status: "stale" });
    await unchanged(s, before);
  });

  it("move: refuses when the order changed under the read", async () => {
    const s = await makeStoreWithRoles("race-move");
    const custom = await addCustom(s.store, "Educator", 450, WORKER);
    const snapshot = await readSnapshot(s.store);
    const role = snapshot.roles.find((r) => r.id === custom.id)!;
    const vmw = snapshot.roles.find((r) => r.builtin === "vm_worker")!;
    await db.update(roleDefinitions).set({ rank: 475 }).where(eq(roleDefinitions.id, custom.id));
    const before = await rolesOf(s.store);
    expect(await swapRanks(s.store, await actorOf(s), snapshot, role, vmw, "up")).toEqual({ status: "stale" });
    await unchanged(s, before);
  });

  it("move: refuses the nesting a change under the read causes", async () => {
    const s = await makeStoreWithRoles("race-move-nest");
    const custom = await addCustom(s.store, "Educator", 450, WORKER);
    const snapshot = await readSnapshot(s.store);
    const role = snapshot.roles.find((r) => r.id === custom.id)!;
    const vmw = snapshot.roles.find((r) => r.builtin === "vm_worker")!;
    // Swapped above the Worker the two would nest; the Worker then gained a permission the Educator lacks.
    await setSwitches(vmw.id, [...WORKER, "layout.edit"]);
    const before = await rolesOf(s.store);
    expect(await swapRanks(s.store, await actorOf(s), snapshot, role, vmw, "up")).toEqual({ status: "stale" });
    await unchanged(s, before);
  });

  it("delete: moves nobody and deletes nothing when someone joined the role after the count was read", async () => {
    const s = await makeStoreWithRoles("race-delete");
    const custom = await addCustom(s.store, "Educator", 450, WORKER);
    const snapshot = await readSnapshot(s.store);
    const role = snapshot.roles.find((r) => r.id === custom.id)!;
    const dest = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    const late = await makePerson(s.store, custom.id);
    const before = await rolesOf(s.store);
    const out = await applyDelete(s.store, await actorOf(s), snapshot, role, dest, { roleId: role.id, version: role.version, moveToId: dest.id, members: 0, invitations: 0 });
    expect(out).toMatchObject({ status: "people-changed", names: expect.any(Array) });
    expect(await roleOf(late.memberId)).toBe(custom.id);
    await unchanged(s, before);
  });

  it("delete: moves nobody and deletes nothing when a role was added since the read", async () => {
    const s = await makeStoreWithRoles("race-delete-pins");
    const custom = await addCustom(s.store, "Educator", 450, WORKER);
    const holder = await makePerson(s.store, custom.id);
    const snapshot = await readSnapshot(s.store);
    const role = snapshot.roles.find((r) => r.id === custom.id)!;
    const dest = snapshot.roles.find((r) => r.builtin === "sales_associate")!;
    await addCustom(s.store, "Late", 700, ["view"]);
    const before = await rolesOf(s.store);
    expect(await applyDelete(s.store, await actorOf(s), snapshot, role, dest, { roleId: role.id, version: role.version, moveToId: dest.id, members: 1, invitations: 0 })).toEqual({ status: "stale" });
    expect(await roleOf(holder.memberId)).toBe(custom.id);
    await unchanged(s, before);
  });

  it("delete: refuses when the role's version moved after it was read", async () => {
    const s = await makeStoreWithRoles("race-delete-version");
    const custom = await addCustom(s.store, "Educator", 450, WORKER);
    const snapshot = await readSnapshot(s.store);
    const role = snapshot.roles.find((r) => r.id === custom.id)!;
    await setSwitches(custom.id, ["view"]);
    const before = await rolesOf(s.store);
    expect(await applyDelete(s.store, await actorOf(s), snapshot, role, undefined, { roleId: role.id, version: role.version, moveToId: null, members: 0, invitations: 0 })).toEqual({ status: "stale" });
    await unchanged(s, before);
    expect(await db.select().from(member).where(eq(member.roleId, custom.id))).toEqual([]);
  });
});
