// The seed's batch against the dev database: idempotent, scoped to one store,
// and all-or-nothing (Review Focus 5).

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { fixtures, productLocations, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { buildDemo, demoStatements } from "./build";

afterAll(dropStores);

const counts = async (storeId: string) => ({
  products: (await db.select({ id: products.id }).from(products).where(eq(products.storeId, storeId))).length,
  locations: (await db.select({ id: productLocations.id }).from(productLocations).where(eq(productLocations.storeId, storeId))).length,
  fixtures: (await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.storeId, storeId))).length,
});

const ids = async (storeId: string) => ({
  products: (await db.select({ id: products.id }).from(products).where(eq(products.storeId, storeId))).map((r) => r.id).sort(),
  fixtures: (await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.storeId, storeId))).map((r) => r.id).sort(),
});

describe("demo seed batch", () => {
  it("gives the same contents on every run", async () => {
    const store = await makeStore("seed-twice");
    await withStore(store, demoStatements(store, buildDemo(store)));
    const first = await counts(store);
    await withStore(store, demoStatements(store, buildDemo(store)));
    expect(await counts(store)).toEqual(first);
    expect(first.products).toBe(50);
  });

  it("never touches another store", async () => {
    const demo = await makeStore("seed-demo");
    const other = await makeStore("seed-other");
    await seedStoreFixtures(other);
    const before = await counts(other);
    await withStore(demo, demoStatements(demo, buildDemo(demo)));
    expect(await counts(other)).toEqual(before);
  });

  it("leaves the old contents in place when the batch fails partway", async () => {
    const store = await makeStore("seed-fail");
    await withStore(store, demoStatements(store, buildDemo(store)));
    // Ids, not just counts: a reseed is the same size, but every run makes fresh ids.
    const before = await ids(store);
    const [first, ...rest] = demoStatements(store, buildDemo(store));
    await expect(withStore(store, [first, ...rest, db.execute(sql`select layout_assert(false, 'boom')`)])).rejects.toThrow();
    expect(await ids(store)).toEqual(before);
  });
});
