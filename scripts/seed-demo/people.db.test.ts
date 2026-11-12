// The demo accounts' placement against the dev database: one per built-in role,
// each member with its role_id set, and the same result when run again.

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { BUILTIN_ROLES } from "@/lib/access/roles";
import { dropPeople, makePerson, seedBuiltinRoles } from "@/lib/access/test-roles";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { DEMO_PEOPLE, placeDemoPerson } from "./people";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const roleNameOf = async (storeId: string, userId: string) => {
  const [row] = await db
    .select({ builtin: roleDefinitions.builtin })
    .from(member)
    .innerJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
    .where(and(eq(member.organizationId, storeId), eq(member.userId, userId)));
  return row?.builtin;
};

describe("DEMO_PEOPLE", () => {
  it("has one account per built-in role, each with its own address", () => {
    expect(DEMO_PEOPLE.map((p) => p.key)).toEqual(BUILTIN_ROLES.map((r) => r.key));
    expect(new Set(DEMO_PEOPLE.map((p) => p.email)).size).toBe(BUILTIN_ROLES.length);
    expect(DEMO_PEOPLE[0].email).toBe("demo.store.manager@liminalbloom.app");
  });
});

describe("placeDemoPerson", () => {
  it("gives each account its role, and re-running changes nothing", async () => {
    const store = await makeStore("demo-people");
    await seedBuiltinRoles(store);
    const accounts = await Promise.all(DEMO_PEOPLE.map(async (p) => ({ ...p, userId: (await makePerson(store, null)).userId })));
    for (let run = 0; run < 2; run++) {
      for (const a of accounts) await placeDemoPerson(store, a.userId, a.key);
      for (const a of accounts) expect(await roleNameOf(store, a.userId), a.key).toBe(a.key);
      expect(await db.select().from(member).where(eq(member.organizationId, store))).toHaveLength(accounts.length);
    }
  });

  it("moves an existing member into the role instead of adding a second membership", async () => {
    const store = await makeStore("demo-people-move");
    const roles = await seedBuiltinRoles(store);
    const { userId } = await makePerson(store, roles.sales_associate);
    await placeDemoPerson(store, userId, "vm_manager");
    expect(await roleNameOf(store, userId)).toBe("vm_manager");
    expect(await db.select().from(member).where(eq(member.userId, userId))).toHaveLength(1);
  });

  it("refuses a store that has no roles", async () => {
    const store = await makeStore("demo-people-bare");
    const { userId } = await makePerson(store, null);
    await expect(placeDemoPerson(store, userId, "store_manager")).rejects.toThrow("no store_manager role");
  });
});
