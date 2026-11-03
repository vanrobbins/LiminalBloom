// What a tile needs to draw a product: its photo key, and its category,
// swatch, texture and colour word for the drawing (Week 6.5 spec §4.6). Snapshots don't carry these, so a planogram joins them by id;
// a product deleted since simply has no look (spec §4.1).

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { imageKeyOf } from "@/lib/products/queries";

import type { ProductLook } from "./types";

export type { ProductLook };

export async function productLooks(storeId: string, ids: readonly string[]): Promise<Record<string, ProductLook>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const [rows] = await withStore(storeId, [
    db
      .select({ id: products.id, imagePath: products.imagePath, categoryName: productCategories.name, swatch: products.swatch, texture: products.texture, colorWord: products.color })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(eq(products.storeId, storeId), inArray(products.id, unique))),
  ] as const);
  return Object.fromEntries(rows.map(({ id, imagePath, ...look }) => [id, { imageKey: imageKeyOf(imagePath), ...look }]));
}
