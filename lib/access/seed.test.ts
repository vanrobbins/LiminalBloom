// giveStoreItsRoles, and the store-creation hook that calls it (lib/auth.ts),
// against the dev database. Stores are made through Better Auth's own
// createOrganization, the path the demo seed uses, so the real hook runs.

import { randomUUID } from "node:crypto";

import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// One test makes seeding fail the way a dropped connection would.
const seeding = vi.hoisted(() => ({ fail: null as Error | null }));
vi.mock("@/lib/access/seed", async (original) => {
  const real = await original<typeof import("@/lib/access/seed")>();
  return {
    ...real,
    giveStoreItsRoles: async (...args: Parameters<typeof real.giveStoreItsRoles>) => {
      if (seeding.fail) throw seeding.fail;
      return real.giveStoreItsRoles(...args);
    },
  };
});

import { db } from "@/db";
import { member, organization, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { BUILTIN_ROLES } from "./roles";
import { giveStoreItsRoles } from "./seed";
import { dropPeople, makePerson } from "./test-roles";

const users: string[] = [];
const madeStores: string[] = [];

afterAll(async () => {
  await dropStores();
  if (madeStores.length) await db.delete(organization).where(inArray(organization.id, madeStores));
  await dropPeople();
  if (users.length) await db.delete(user).where(inArray(user.id, users));
});

beforeEach(() => {
  seeding.fail = null;
});

async function rolesOf(storeId: string) {
  return db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).orderBy(asc(roleDefinitions.rank));
}

async function createdThroughBetterAuth(label: string): Promise<{ slug: string; userId: string }> {
  const userId = `test_seed_${randomUUID().slice(0, 8)}`;
  users.push(userId);
  await db.insert(user).values({ id: userId, name: label, email: `${userId}@example.com` });
  return { slug: `test-seed-${label}-${randomUUID().slice(0, 8)}`, userId };
}

describe("the store-creation hook", () => {
  it("gives a new store its five built-in roles and makes its creator the Store Manager", async () => {
    const { slug, userId } = await createdThroughBetterAuth("hook");
    const store = await auth.api.createOrganization({ body: { name: "Seed hook store", slug, userId } });
    if (!store) throw new Error("Better Auth did not create the store.");
    madeStores.push(store.id);

    const roles = await rolesOf(store.id);
    expect(roles.map((r) => r.builtin)).toEqual(BUILTIN_ROLES.map((r) => r.key));
    const [owner] = await db.select().from(member).where(eq(member.organizationId, store.id));
    expect(owner.userId).toBe(userId);
    expect(owner.roleId).toBe(roles.find((r) => r.builtin === "store_manager")?.id);
  });

  it("removes the store and surfaces the error when seeding fails", async () => {
    const { slug, userId } = await createdThroughBetterAuth("fail");
    seeding.fail = new Error("roles unavailable");
    await expect(auth.api.createOrganization({ body: { name: "Seed fail store", slug, userId } })).rejects.toThrow(
      /roles unavailable/,
    );
    expect(await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, slug))).toEqual([]);
  });
});

describe("giveStoreItsRoles", () => {
  it("changes nothing when run twice", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = await makeStore("seed-twice", { roles: false });
    await giveStoreItsRoles(store);
    const first = await rolesOf(store);
    await giveStoreItsRoles(store);
    const second = await rolesOf(store);
    expect(warn).not.toHaveBeenCalled(); // a normal run logs nothing
    warn.mockRestore();
    expect(first).toHaveLength(5);
    expect(second).toEqual(first);
  });

  it("repairs a store missing roles with the migration's mapping, and leaves edits and held roles alone", async () => {
    const store = await makeStore("seed-repair", { roles: false });
    // An edited Sales Associate at a non-default rank, so only its builtin tag protects it.
    const [edited] = await db
      .insert(roleDefinitions)
      .values({ storeId: store, builtin: "sales_associate", name: "Floor Staff", rank: 550, switches: ["view"] })
      .returning();
    const holder = await makePerson(store, edited.id, "owner");
    const owner = await makePerson(store, null, "owner");
    const admin = await makePerson(store, null, "admin");
    const plain = await makePerson(store, null, "member");
    const both = await makePerson(store, null, "member, admin");

    await giveStoreItsRoles(store);

    const roles = await rolesOf(store);
    const idOf = (key: string) => roles.find((r) => r.builtin === key)?.id;
    expect(roles.map((r) => r.builtin)).toEqual(BUILTIN_ROLES.map((r) => r.key));
    expect(roles.find((r) => r.builtin === "sales_associate")).toMatchObject({ id: edited.id, name: "Floor Staff", switches: ["view"] });

    const held = async (p: { memberId: string }) =>
      (await db.select({ roleId: member.roleId }).from(member).where(eq(member.id, p.memberId)))[0].roleId;
    expect(await held(owner)).toBe(idOf("store_manager"));
    expect(await held(admin)).toBe(idOf("assistant_manager"));
    expect(await held(both)).toBe(idOf("assistant_manager"));
    expect(await held(plain)).toBe(edited.id);
    // Already held a role: not remapped from its Better Auth role of owner.
    expect(await held(holder)).toBe(edited.id);
  });

  it("leaves out a built-in whose default rank a custom role took, without failing", async () => {
    const store = await makeStore("seed-rank", { roles: false });
    await db.insert(roleDefinitions).values({ storeId: store, builtin: null, name: "Keyholder", rank: 200, switches: ["view"] });
    const plain = await makePerson(store, null, "admin");

    await expect(giveStoreItsRoles(store)).resolves.toBeUndefined();

    const roles = await rolesOf(store);
    expect(roles.map((r) => r.builtin)).toEqual(["store_manager", null, "vm_manager", "vm_worker", "sales_associate"]);
    // Its Assistant Manager is the one left out, so this admin stays unassigned for now.
    const [row] = await db.select({ roleId: member.roleId }).from(member).where(eq(member.id, plain.memberId));
    expect(row.roleId).toBeNull();
  });
});
