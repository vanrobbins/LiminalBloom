// giveStoreItsRoles: isolation between stores, a custom role holding a built-in's
// name, and the warning when a store ends with no Store Manager role.

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { dropPeople, makePerson, seedBuiltinRoles } from "./test-roles";
import { giveStoreItsRoles } from "./seed";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

afterEach(() => vi.restoreAllMocks());

const rolesOf = (storeId: string) =>
  db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).orderBy(roleDefinitions.rank);
const roleIdOf = async (memberId: string) =>
  (await db.select({ roleId: member.roleId }).from(member).where(inArray(member.id, [memberId])))[0].roleId;

describe("giveStoreItsRoles edge cases", () => {
  it("only touches the store it is given", async () => {
    const other = await makeStore("seed-other");
    const mine = await makeStore("seed-mine");
    await seedBuiltinRoles(other);
    const theirs = await makePerson(other, null, "owner");
    const before = await rolesOf(other);

    await giveStoreItsRoles(mine);

    expect(await roleIdOf(theirs.memberId)).toBeNull();
    const after = await rolesOf(other);
    expect(after).toEqual(before);
    expect(after.map((r) => [r.id, r.name, r.rank, r.switches])).toEqual(before.map((r) => [r.id, r.name, r.rank, r.switches]));
  });

  it("does not add a second Sales Associate when a custom role has the name", async () => {
    const store = await makeStore("seed-name", { roles: false });
    await db.insert(roleDefinitions).values({ storeId: store, builtin: null, name: "Sales Associate", rank: 550, switches: ["view"] });
    const plain = await makePerson(store, null, "member");

    await expect(giveStoreItsRoles(store)).resolves.toBeUndefined();

    const roles = await rolesOf(store);
    expect(roles.filter((r) => r.name.toLowerCase() === "sales associate")).toHaveLength(1);
    expect(roles.some((r) => r.builtin === "sales_associate")).toBe(false);
    expect(await roleIdOf(plain.memberId)).toBeNull();
  });

  it("warns once, naming the store, when its Store Manager role cannot be made", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = await makeStore("seed-nomanager", { roles: false });
    await db.insert(roleDefinitions).values({ storeId: store, builtin: null, name: "Boss", rank: 100, switches: ["view"] });
    const owner = await makePerson(store, null, "owner");

    await expect(giveStoreItsRoles(store)).resolves.toBeUndefined();

    expect((await rolesOf(store)).some((r) => r.builtin === "store_manager")).toBe(false);
    expect(await roleIdOf(owner.memberId)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(store);
  });
});
