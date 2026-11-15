// Migration 0018's backfill: the five built-in roles for every store that
// existed then, and member.role_id from member.role. Neither check depends on
// a timestamp or on rows other people made.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { asc, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { BUILTIN_ROLES, type BuiltinRoleKey } from "./roles";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const MIGRATION = "0018_access_roles";

// Better Auth role string -> the built-in the migration gives it. Written out, not derived.
// "", "Owner" and "owner	" are the migration's actual behaviour for values Better Auth never
// writes; production is pre-checked for them before the migration runs.
const EXPECTED: Record<string, BuiltinRoleKey> = {
  owner: "store_manager",
  admin: "assistant_manager",
  member: "sales_associate",
  "admin,member": "assistant_manager",
  "member,owner": "store_manager",
  "member, admin": "assistant_manager",
  "owner,admin": "store_manager",
  "co-owner": "sales_associate",
  custom: "sales_associate",
  "": "sales_associate",
  Owner: "sales_associate",
  "owner	": "sales_associate",
};

// The migration's own INSERT is run against a throwaway store that has no roles, narrowed to that
// store, like the UPDATE below. Reading the statement from the file tests what shipped, and no
// other store's rows (dev data anyone may have renamed) are involved.
const migrationStatement = (startsWith: string) => {
  const statement = readFileSync(resolve(`db/migrations/${MIGRATION}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .find((s) => s.includes(startsWith));
  if (!statement) throw new Error(`The backfill statement ${startsWith} is not where this test expects it`);
  return statement;
};

describe("the migration's backfill", () => {
  it("gives a store with no roles exactly the five, matching lib/access/roles.ts", async () => {
    const store = await makeStore("bf-insert", { roles: false });
    const statement = migrationStatement('INSERT INTO "role_definitions"');
    const anchor = 'AS b("builtin", "name", "rank", "switches")';
    if (!statement.includes(anchor)) throw new Error("The backfill INSERT is not shaped as this test expects");
    await db.execute(sql.raw(`${statement.replace(/;$/, "")} WHERE o."id" = '${store}'`));
    const rows = await db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, store)).orderBy(asc(roleDefinitions.rank));
    expect(rows.map((r) => [r.builtin, r.name, r.rank, r.switches])).toEqual(BUILTIN_ROLES.map((r) => [r.key, r.name, r.rank, [...r.switches]]));
  });
});

// The migration's own UPDATE is run against a throwaway store with every shape
// of Better Auth role, narrowed to that store. The statement is read from the
// migration file, so this tests what shipped, not a copy of it.
describe("the migration's member mapping", () => {
  it("maps owner, then admin, then everything else, including lists and spaces", async () => {
    const { store } = await makeStoreWithRoles("bf-map");
    const made = await Promise.all(Object.keys(EXPECTED).map(async (role) => ({ role, ...(await makePerson(store, null, role)) })));

    const statement = migrationStatement('UPDATE "member" m SET "role_id"');
    const anchor = 'WHERE r."store_id" = m."organization_id"';
    if (!statement.includes(anchor)) throw new Error("The backfill UPDATE is not where this test expects it");
    await db.execute(sql.raw(statement.replace(anchor, `${anchor} AND m."organization_id" = '${store}'`).replace(/;$/, "")));

    for (const { role, memberId } of made) {
      const [row] = await db
        .select({ builtin: roleDefinitions.builtin })
        .from(member)
        .innerJoin(roleDefinitions, eq(roleDefinitions.id, member.roleId))
        .where(eq(member.id, memberId));
      expect(row.builtin, `Better Auth role ${JSON.stringify(role)}`).toBe(EXPECTED[role]);
    }
  });
});
