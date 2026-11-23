// Migration 0020's role flag backfill against the dev database; the statement is read from the file.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores, makeStore } from "@/lib/products/test-stores";

afterAll(async () => {
  await dropStores();
});

describe("roles that require two-factor", () => {
  const backfill = () => {
    const statement = readFileSync(resolve("db/migrations/0020_platform_help.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .find((s) => s.includes('UPDATE "role_definitions" SET "requires_two_factor"'));
    if (!statement) throw new Error("The role flag backfill is not where this test expects it");
    return statement.replace(/;$/, "");
  };

  it("is off for a role inserted without it, and the migration's backfill turns it on for roles holding people.manage or roles.manage only", async () => {
    const { store } = await makeStoreWithRoles("pl-flag");
    const flags = async () =>
      Object.fromEntries((await db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, store))).map((r) => [r.builtin ?? r.name, r.requiresTwoFactor]));
    // The seed now sets the flag itself, so clear it to stand in for rows that predate the column.
    await db.update(roleDefinitions).set({ requiresTwoFactor: false }).where(eq(roleDefinitions.storeId, store));
    expect(Object.values(await flags()).every((on) => on === false)).toBe(true);
    await db.insert(roleDefinitions).values({ storeId: store, name: "Floor Lead", rank: 250, switches: ["view", "people.manage"] });
    await db.insert(roleDefinitions).values({ storeId: store, name: "Greeter", rank: 260, switches: ["view", "products.stock"] });
    expect(Object.values(await flags()).every((on) => on === false)).toBe(true);

    // Narrowed to this store, like lib/access/backfill.db.test.ts does for 0018.
    await db.execute(sql.raw(`${backfill()} AND "store_id" = '${store}'`));

    expect(await flags()).toEqual({
      store_manager: true,
      assistant_manager: true,
      vm_manager: true,
      vm_worker: false,
      sales_associate: false,
      "Floor Lead": true,
      Greeter: false,
    });
  });

  it("skips the demo store, by name or by a suffixed slug", async () => {
    const byName = await makeStore("pl-demo-name", { roles: true });
    const bySlug = await makeStore("pl-demo-slug", { roles: true });
    const other = await makeStore("pl-demo-other", { roles: true });
    await db.update(organization).set({ name: "Liminal Bloom Demo" }).where(eq(organization.id, byName));
    await db.update(organization).set({ slug: "liminal-bloom-demo-x7k2" }).where(eq(organization.id, bySlug));
    const ids = [byName, bySlug, other];
    await db.update(roleDefinitions).set({ requiresTwoFactor: false }).where(inArray(roleDefinitions.storeId, ids));

    await db.execute(sql.raw(`${backfill()} AND "store_id" IN (${ids.map((i) => `'${i}'`).join(",")})`));

    const on = async (store: string) =>
      (await db.select().from(roleDefinitions).where(and(eq(roleDefinitions.storeId, store), eq(roleDefinitions.requiresTwoFactor, true)))).length;
    expect(await on(byName)).toBe(0);
    expect(await on(bySlug)).toBe(0);
    expect(await on(other)).toBeGreaterThan(0);
  });
});
