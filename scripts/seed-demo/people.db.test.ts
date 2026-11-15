// The demo accounts' placement against the dev database: one per built-in role,
// each member with its role_id set, and the same result when run again.

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { BUILTIN_ROLES } from "@/lib/access/roles";
import { dropPeople, makePerson, seedBuiltinRoles } from "@/lib/access/test-roles";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { auth } from "@/lib/auth";

import { DEMO_PEOPLE, placeDemoPerson, seedDemoPeople, type DemoPerson } from "./people";

const signedUp: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (signedUp.length) await db.delete(user).where(inArray(user.id, signedUp.splice(0)));
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
    const store = await makeStore("demo-people-bare", { roles: false });
    const { userId } = await makePerson(store, null);
    await expect(placeDemoPerson(store, userId, "store_manager")).rejects.toThrow("no store_manager role");
  });
});

// Production's sign-up is open, so a demo address may belong to a stranger: the seed adopts an
// existing account only if it is in the demo store or has the demo password (M1, 13b).
describe("seedDemoPeople on production", () => {
  const demoPassword = process.env.DEMO_PASSWORD!;
  const one = (email: string): DemoPerson[] => [{ key: "vm_manager", name: "Demo VM", email }];
  const registered = async (password: string) => {
    const email = `seed-${randomUUID().slice(0, 8)}@example.test`;
    const { user: made } = await auth.api.signUpEmail({ body: { email, password, name: "Someone" } });
    signedUp.push(made.id);
    return { email, userId: made.id };
  };

  it("stops on an existing account that is not in the store and does not use the demo password, naming it and changing nothing", async () => {
    const store = await makeStore("seed-stranger");
    const stranger = await registered("not-the-demo-password-1");
    await expect(seedDemoPeople(store, { isProduction: true, people: one(stranger.email) })).rejects.toThrow(stranger.email);
    expect(await db.select().from(member).where(eq(member.organizationId, store))).toHaveLength(0);
  });

  it("checks every account before placing any, so one stranger leaves the others unplaced", async () => {
    const store = await makeStore("seed-all-or-none");
    const ours = await registered(demoPassword);
    const stranger = await registered("not-the-demo-password-2");
    const people: DemoPerson[] = [...one(ours.email), { key: "vm_worker", name: "Demo W", email: stranger.email }];
    await expect(seedDemoPeople(store, { isProduction: true, people })).rejects.toThrow(stranger.email);
    expect(await db.select().from(member).where(eq(member.organizationId, store))).toHaveLength(0);
  });

  it("adopts an existing account that still has the demo password", async () => {
    const store = await makeStore("seed-ours");
    const ours = await registered(demoPassword);
    expect(await seedDemoPeople(store, { isProduction: true, people: one(ours.email) })).toBe(1);
    expect(await roleNameOf(store, ours.userId)).toBe("vm_manager");
  });

  it("keeps an account already in the demo store without asking for its password", async () => {
    const store = await makeStore("seed-member");
    const roles = await seedBuiltinRoles(store);
    const stranger = await registered("changed-since-seeding-3");
    await db.insert(member).values({ id: randomUUID(), organizationId: store, userId: stranger.userId, role: "member", roleId: roles.sales_associate, createdAt: new Date() });
    await seedDemoPeople(store, { isProduction: true, people: one(stranger.email) });
    expect(await roleNameOf(store, stranger.userId)).toBe("vm_manager");
  });

  it("creates an account that does not exist yet", async () => {
    const store = await makeStore("seed-new");
    const email = `seed-${randomUUID().slice(0, 8)}@example.test`;
    await seedDemoPeople(store, { isProduction: true, people: one(email) });
    const [made] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    signedUp.push(made.id);
    expect(await roleNameOf(store, made.id)).toBe("vm_manager");
  });
});
