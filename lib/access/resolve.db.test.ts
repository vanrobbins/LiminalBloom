// resolveAccess against the dev database: a person's role and switches in the
// store a request works in. Rows are written as the table owner by the helpers
// in test-roles.ts, so the real function reads what a real store would hold.

import { and, count, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { makeStore, dropStores } from "@/lib/products/test-stores";

import { BUILTIN_ROLES } from "./roles";
import { resolveAccess } from "./resolve";
import type { Switch } from "./switches";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const sorted = (s: Iterable<Switch>) => [...s].sort();

describe("resolveAccess", () => {
  it.each(BUILTIN_ROLES.map((r) => [r.name, r] as const))("gives a %s exactly its default switches", async (_name, role) => {
    const { store, roles } = await makeStoreWithRoles("res-builtin");
    const { userId } = await makePerson(store, roles[role.key]);
    const access = await resolveAccess(userId, store);
    expect(access.activeStoreId).toBe(store);
    expect(access.role).toEqual({ id: roles[role.key], name: role.name, rank: role.rank, builtin: role.key });
    expect(sorted(access.switches)).toEqual(sorted(role.switches));
  });

  it("gives a member with no role view only, and no role", async () => {
    const { store } = await makeStoreWithRoles("res-null");
    const { userId } = await makePerson(store, null, "owner");
    const access = await resolveAccess(userId, store);
    expect(access.activeStoreId).toBe(store);
    expect(access.role).toBeNull();
    expect(sorted(access.switches)).toEqual(["view"]);
  });

  it("ignores a stored switch it does not know", async () => {
    const { store, roles } = await makeStoreWithRoles("res-unknown");
    const { userId } = await makePerson(store, roles.sales_associate);
    await db
      .update(roleDefinitions)
      .set({ switches: ["view", "products.stock", "teleport", "PRODUCTS.EDIT", ""] })
      .where(eq(roleDefinitions.id, roles.sales_associate));
    expect(sorted((await resolveAccess(userId, store)).switches)).toEqual(["products.stock", "view"]);
  });

  it("gives a Store Manager stored without its locked switches those switches, and every role view", async () => {
    const { store, roles } = await makeStoreWithRoles("res-locked");
    const manager = await makePerson(store, roles.store_manager);
    const worker = await makePerson(store, roles.vm_worker);
    await db.update(roleDefinitions).set({ switches: ["products.edit"] }).where(eq(roleDefinitions.id, roles.store_manager));
    await db.update(roleDefinitions).set({ switches: [] }).where(eq(roleDefinitions.id, roles.vm_worker));
    expect(sorted((await resolveAccess(manager.userId, store)).switches)).toEqual(["people.manage", "products.edit", "roles.manage", "store.settings", "view"]);
    // Locks belong to the Store Manager only; no other role gains anything but view.
    expect(sorted((await resolveAccess(worker.userId, store)).switches)).toEqual(["view"]);
  });

  it("follows a role edit on the very next call", async () => {
    const { store, roles } = await makeStoreWithRoles("res-edit");
    const { userId } = await makePerson(store, roles.sales_associate);
    expect((await resolveAccess(userId, store)).switches.has("products.sale")).toBe(false);
    await db.update(roleDefinitions).set({ switches: ["view", "products.stock", "products.sale"] }).where(eq(roleDefinitions.id, roles.sales_associate));
    expect((await resolveAccess(userId, store)).switches.has("products.sale")).toBe(true);
    await db.update(roleDefinitions).set({ name: "Floor Lead" }).where(eq(roleDefinitions.id, roles.sales_associate));
    expect((await resolveAccess(userId, store)).role?.name).toBe("Floor Lead");
  });

  it("reads the role of the store asked for, not of the person's other store", async () => {
    const a = await makeStoreWithRoles("res-two-a");
    const b = await makeStoreWithRoles("res-two-b");
    const { userId } = await makePerson(a.store, a.roles.store_manager);
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: b.store, userId, role: "member", roleId: b.roles.sales_associate, createdAt: new Date(Date.now() + 1000) });
    expect((await resolveAccess(userId, a.store)).role?.builtin).toBe("store_manager");
    expect((await resolveAccess(userId, b.store)).role?.builtin).toBe("sales_associate");
    expect(sorted((await resolveAccess(userId, b.store)).switches)).toEqual(["products.stock", "view"]);
  });

  it("falls back to the person's own store when the session names one they do not belong to", async () => {
    const mine = await makeStoreWithRoles("res-mine");
    const theirs = await makeStoreWithRoles("res-theirs");
    const { userId } = await makePerson(mine.store, mine.roles.vm_manager);
    const access = await resolveAccess(userId, theirs.store);
    expect(access.activeStoreId).toBe(mine.store);
    expect(access.role?.builtin).toBe("vm_manager");
  });

  it("resolves a person removed from their store to no store, no role and no switches", async () => {
    const { store, roles } = await makeStoreWithRoles("res-removed");
    const { userId } = await makePerson(store, roles.store_manager);
    await db.delete(member).where(and(eq(member.userId, userId), eq(member.organizationId, store)));
    expect(await resolveAccess(userId, store)).toEqual({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false });
  });

  it("gives a store with no roles at all its roles, and its Better Auth owner the Store Manager role", async () => {
    const store = await makeStore("res-noroles", { roles: false });
    const owner = await makePerson(store, null, "owner");
    const other = await makePerson(store, null, "member");
    const access = await resolveAccess(owner.userId, store);
    expect(access.role?.builtin).toBe("store_manager");
    expect(access.switches.has("store.settings")).toBe(true);
    const [{ total }] = await db.select({ total: count() }).from(roleDefinitions).where(eq(roleDefinitions.storeId, store));
    expect(total).toBe(5);
    expect((await resolveAccess(other.userId, store)).role?.builtin).toBe("sales_associate");
    const [{ again }] = await db.select({ again: count() }).from(roleDefinitions).where(eq(roleDefinitions.storeId, store));
    expect(again).toBe(5);
  });

  it("does not re-seed or re-map a store that has roles, whatever a member's role_id says", async () => {
    const { store, roles } = await makeStoreWithRoles("res-noremap");
    // Better Auth says owner; the app's role_id is null on purpose. The app's data wins: nothing fails open.
    const { userId } = await makePerson(store, null, "owner");
    // A built-in the store deleted must not come back either.
    await db.update(member).set({ roleId: null }).where(eq(member.organizationId, store));
    await db.delete(roleDefinitions).where(eq(roleDefinitions.id, roles.vm_worker));
    const access = await resolveAccess(userId, store);
    expect(access.role).toBeNull();
    expect(sorted(access.switches)).toEqual(["view"]);
    const [row] = await db.select({ roleId: member.roleId }).from(member).where(eq(member.userId, userId));
    expect(row.roleId).toBeNull();
    const [{ total }] = await db.select({ total: count() }).from(roleDefinitions).where(eq(roleDefinitions.storeId, store));
    expect(total).toBe(4);
  });
});
