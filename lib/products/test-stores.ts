// Throwaway stores for database tests (like lib/layout/save.test.ts). Rows are
// written as the owner, which row-level security does not restrict, because
// setting up is not what the tests check.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import {
  fixtureFaces,
  fixtures,
  productCategories,
  productLocations,
  products,
  stockroomBins,
} from "@/db/schema";

const created: string[] = [];

export async function makeStore(label: string): Promise<string> {
  const id = `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(organization).values({ id, name: `Test store ${label}`, slug: id, createdAt: new Date() });
  created.push(id);
  return id;
}

export async function dropStores(): Promise<void> {
  if (created.length === 0) return;
  await db.delete(organization).where(inArray(organization.id, created.splice(0)));
}

export type StoreFixtures = {
  categoryId: string;
  categoryVersion: number;
  productId: string;
  productVersion: number;
  styleNumber: string;
  fixtureId: string;
  faceId: string;
  binId: string;
  locationId: string;
};

/** One of everything: a category, a product on a table's top, and a bin. */
export async function seedStoreFixtures(storeId: string, name = "High-Rise Pant"): Promise<StoreFixtures> {
  const styleNumber = `HRP-${randomUUID().slice(0, 6)}`;
  const [category] = await db
    .insert(productCategories)
    .values({ storeId, name: "Pants" })
    .returning({ id: productCategories.id, version: productCategories.version });
  const [product] = await db
    .insert(products)
    .values({ storeId, name, styleNumber, categoryId: category.id, color: "Black" })
    .returning({ id: products.id, version: products.version });
  const fixtureId = randomUUID();
  await db.insert(fixtures).values({ id: fixtureId, storeId, type: "table", name: "Front table 1", x: 100, y: 100, width: 72, depth: 36 });
  const faceId = randomUUID();
  await db.insert(fixtureFaces).values({ id: faceId, storeId, fixtureId, side: "top", columns: 6, rows: 3 });
  const [bin] = await db.insert(stockroomBins).values({ storeId, code: "B-12" }).returning({ id: stockroomBins.id });
  const [location] = await db
    .insert(productLocations)
    .values({ storeId, productId: product.id, presentation: "folded", faceId, col: 0, row: 0, colSpan: 2, rowSpan: 2 })
    .returning({ id: productLocations.id });
  return {
    categoryId: category.id,
    categoryVersion: category.version,
    productId: product.id,
    productVersion: product.version,
    styleNumber,
    fixtureId,
    faceId,
    binId: bin.id,
    locationId: location.id
  };
}

export async function productCount(storeId: string): Promise<number> {
  return (await db.select({ id: products.id }).from(products).where(eq(products.storeId, storeId))).length;
}
