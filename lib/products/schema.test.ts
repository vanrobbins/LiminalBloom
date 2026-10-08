// Migration 0006 against the real dev database: store isolation through RLS,
// store-scoped keys, the location shape, and the generated search text.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  productCategories,
  productFootprints,
  productLocations,
  products,
  stockroomBins,
} from "@/db/schema";
import { withStore } from "@/lib/db/with-store";

import { dropStores, makeStore, seedStoreFixtures } from "./test-stores";

afterAll(dropStores);

describe("row-level security on the product library", () => {
  it("shows a store only its own rows in all five tables", async () => {
    const a = await makeStore("rls-a");
    const b = await makeStore("rls-b");
    const fa = await seedStoreFixtures(a);
    const fb = await seedStoreFixtures(b);
    await db.insert(productFootprints).values([
      { storeId: a, productId: fa.productId, presentation: "hung", columns: 1, rows: 3, stackLimit: 4 },
      { storeId: b, productId: fb.productId, presentation: "hung", columns: 1, rows: 3, stackLimit: 4 },
    ]);
    // No store filter on purpose: only the policy narrows these.
    const [p, c, f, s, l] = await withStore(a, [
      db.select({ storeId: products.storeId }).from(products),
      db.select({ storeId: productCategories.storeId }).from(productCategories),
      db.select({ storeId: productFootprints.storeId }).from(productFootprints),
      db.select({ storeId: stockroomBins.storeId }).from(stockroomBins),
      db.select({ storeId: productLocations.storeId }).from(productLocations),
    ] as const);
    for (const rows of [p, c, f, s, l]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.storeId === a)).toBe(true);
    }
  });

  it("refuses to write a product into another store", async () => {
    const a = await makeStore("rls-write-a");
    const b = await makeStore("rls-write-b");
    const fb = await seedStoreFixtures(b);
    await expect(
      withStore(a, [
        db.insert(products).values({ storeId: b, name: "Smuggled", styleNumber: "X-1", categoryId: fb.categoryId, color: "Red" }),
      ]),
    ).rejects.toThrow();
  });
});

describe("store-scoped keys", () => {
  it("refuses a product pointing at another store's category", async () => {
    const a = await makeStore("fk-a");
    const b = await makeStore("fk-b");
    const fb = await seedStoreFixtures(b);
    await expect(
      db.insert(products).values({ storeId: a, name: "Crossed", styleNumber: "X-2", categoryId: fb.categoryId, color: "Red" }),
    ).rejects.toThrow();
  });

  it("refuses a location on another store's face", async () => {
    const a = await makeStore("fk-face-a");
    const b = await makeStore("fk-face-b");
    const fa = await seedStoreFixtures(a);
    const fb = await seedStoreFixtures(b);
    await expect(
      db.insert(productLocations).values({ storeId: a, productId: fa.productId, presentation: "hung", faceId: fb.faceId, col: 0, row: 0, colSpan: 1, rowSpan: 1 }),
    ).rejects.toThrow();
  });

  it("deleting a category deletes its products and their locations", async () => {
    const a = await makeStore("cascade");
    const fa = await seedStoreFixtures(a);
    await db.delete(productCategories).where(eq(productCategories.id, fa.categoryId));
    expect(await db.select().from(products).where(eq(products.id, fa.productId))).toEqual([]);
    expect(await db.select().from(productLocations).where(eq(productLocations.id, fa.locationId))).toEqual([]);
  });
});

describe("location shape", () => {
  it("refuses a location with both a face and a bin", async () => {
    const a = await makeStore("shape-both");
    const fa = await seedStoreFixtures(a);
    await expect(
      db.insert(productLocations).values({ storeId: a, productId: fa.productId, presentation: "hung", faceId: fa.faceId, col: 0, row: 0, colSpan: 1, rowSpan: 1, binId: fa.binId }),
    ).rejects.toThrow();
  });

  it("refuses a location with neither", async () => {
    const a = await makeStore("shape-none");
    const fa = await seedStoreFixtures(a);
    await expect(db.insert(productLocations).values({ storeId: a, productId: fa.productId, presentation: "hung" })).rejects.toThrow();
  });

  it("accepts a bin location", async () => {
    const a = await makeStore("shape-bin");
    const fa = await seedStoreFixtures(a);
    await expect(db.insert(productLocations).values({ storeId: a, productId: fa.productId, presentation: "folded", binId: fa.binId })).resolves.toBeDefined();
  });
});

describe("search text", () => {
  it("is the lowercased name, style number and color", async () => {
    const a = await makeStore("search-text");
    const fa = await seedStoreFixtures(a, "High-Rise Pant");
    const [row] = await db.select({ text: products.searchText, style: products.styleNumber }).from(products).where(eq(products.id, fa.productId));
    expect(row.text).toBe(`high-rise pant ${row.style.toLowerCase()} black`);
  });

  it("has the trigram extension", async () => {
    const result = await db.execute(sql`select extname from pg_extension where extname = 'pg_trgm'`);
    expect(result.rows).toHaveLength(1);
  });
});
