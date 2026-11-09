// Category writes (spec §5.3), on the same rules as lib/products/write.ts: one
// store-scoped batch, every update or delete guarded by the version the form read.

import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { conflictLabel } from "@/lib/layout/save";

import type { CategoryInput } from "./schemas";
import { attempt, guarded, type SaveOutcome } from "./write";

export type DeleteCategoryOutcome =
  | { status: "saved"; imagePaths: string[] }
  | { status: "conflict" }
  | { status: "count-changed"; count: number };

const categoryWhere = (storeId: string, id: string, version: number) =>
  and(eq(productCategories.id, id), eq(productCategories.storeId, storeId), eq(productCategories.version, version));

export function createCategory(storeId: string, input: CategoryInput): Promise<SaveOutcome<{ id: string }>> {
  return attempt(async () => {
    const [rows] = await withStore(storeId, [
      db.insert(productCategories).values({ storeId, ...input }).returning({ id: productCategories.id }),
    ] as const);
    return { status: "saved" as const, id: rows[0].id };
  });
}

export function updateCategory(storeId: string, id: string, expectedVersion: number, input: CategoryInput): Promise<SaveOutcome> {
  return attempt(async () => {
    await withStore(storeId, [
      guarded(
        db
          .update(productCategories)
          .set({ ...input, version: sql`${productCategories.version} + 1`, updatedAt: new Date() })
          .where(categoryWhere(storeId, id, expectedVersion))
          .returning({ id: productCategories.id }),
        "category",
      ),
    ]);
    return { status: "saved" as const };
  });
}

export async function deleteCategory(
  storeId: string,
  id: string,
  expectedVersion: number,
  expectedCount: number,
): Promise<DeleteCategoryOutcome> {
  try {
    const [images] = await withStore(storeId, [
      db
        .select({ path: products.imagePath })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.categoryId, id), isNotNull(products.imagePath))),
      // The count the dialog showed must still be true, or more would go than the person agreed to.
      guarded(
        db
          .delete(productCategories)
          .where(
            and(
              categoryWhere(storeId, id, expectedVersion),
              sql`(select count(*) from ${products} where ${products.categoryId} = ${id}) = ${expectedCount}`,
            ),
          )
          .returning({ id: productCategories.id }),
        "category",
      ),
    ] as const);
    return { status: "saved", imagePaths: images.flatMap((r) => (r.path ? [r.path] : [])) };
  } catch (error) {
    if (conflictLabel(error) === null) throw error;
    const [rows] = await withStore(storeId, [
      db
        .select({
          version: productCategories.version,
          count: sql<number>`(select count(*)::int from ${products} where ${products.categoryId} = ${id})`,
        })
        .from(productCategories)
        .where(and(eq(productCategories.id, id), eq(productCategories.storeId, storeId))),
    ] as const);
    const current = rows[0];
    if (!current || current.version !== expectedVersion) return { status: "conflict" };
    return { status: "count-changed", count: current.count };
  }
}
