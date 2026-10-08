// The product library's writes (spec §5.2–5.3). Each runs as one store-scoped
// batch, and every update or delete is guarded by the version the form read:
// if another device saved first, the guard matches nothing, layout_assert
// raises, and the whole batch rolls back, so nothing is half-written.

import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNotNull, sql, type SQLWrapper } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { productCategories, productFootprints, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { conflictLabel } from "@/lib/layout/save";
import type { ProductStatus } from "@/lib/product-status";

import { databaseError } from "./errors";
import { PRESENTATIONS } from "./footprint";
import type { CategoryInput, ProductInput } from "./schemas";

export type Refusal =
  | { status: "conflict" }
  | { status: "duplicate"; field: "name" | "styleNumber" }
  | { status: "not-found" };

export type SaveOutcome<T extends object = object> = ({ status: "saved" } & T) | Refusal;

export type DeleteCategoryOutcome =
  | { status: "saved"; imagePaths: string[] }
  | { status: "conflict" }
  | { status: "count-changed"; count: number };

type Statements = [BatchItem<"pg">, ...BatchItem<"pg">[]];

// Drizzle already wraps an interpolated builder in parentheses (lib/layout/write.ts).
function guarded(query: SQLWrapper, label: string): BatchItem<"pg"> {
  return db.execute(sql`with changed as ${query} select layout_assert((select count(*) from changed) = 1, ${label})`);
}

/** A refusal the person can act on, or null for a real failure to rethrow. */
function refusal(error: unknown): Refusal | null {
  if (conflictLabel(error) !== null) return { status: "conflict" };
  const failure = databaseError(error);
  if (failure?.code === "23505" && failure.constraint === "products_style_unique") return { status: "duplicate", field: "styleNumber" };
  if (failure?.code === "23505" && failure.constraint === "product_categories_name_unique") return { status: "duplicate", field: "name" };
  // A foreign key: the category is not this store's, or is gone.
  if (failure?.code === "23503") return { status: "not-found" };
  return null;
}

async function attempt<T extends object>(run: () => Promise<{ status: "saved" } & T>): Promise<SaveOutcome<T>> {
  try {
    return await run();
  } catch (error) {
    const refused = refusal(error);
    if (refused) return refused;
    throw error;
  }
}

const categoryWhere = (storeId: string, id: string, version: number) =>
  and(eq(productCategories.id, id), eq(productCategories.storeId, storeId), eq(productCategories.version, version));
const productWhere = (storeId: string, id: string, version: number) =>
  and(eq(products.id, id), eq(products.storeId, storeId), eq(products.version, version));

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

const productRow = (input: ProductInput) => ({
  name: input.name,
  styleNumber: input.styleNumber,
  categoryId: input.categoryId,
  color: input.color,
  sizeRange: input.sizeRange,
  status: input.status,
});

function overrideInserts(storeId: string, productId: string, overrides: ProductInput["overrides"]): BatchItem<"pg">[] {
  return PRESENTATIONS.flatMap((presentation) => {
    const f = overrides[presentation];
    return f ? [db.insert(productFootprints).values({ storeId, productId, presentation, ...f })] : [];
  });
}

export function createProduct(storeId: string, input: ProductInput): Promise<SaveOutcome<{ id: string }>> {
  return attempt(async () => {
    // Made here so the overrides can go in the same batch as the product.
    const id = randomUUID();
    const statements: Statements = [
      db.insert(products).values({ id, storeId, ...productRow(input) }),
      ...overrideInserts(storeId, id, input.overrides),
    ];
    await withStore(storeId, statements);
    return { status: "saved" as const, id };
  });
}

export function updateProduct(storeId: string, id: string, expectedVersion: number, input: ProductInput): Promise<SaveOutcome> {
  return attempt(async () => {
    const statements: Statements = [
      guarded(
        db
          .update(products)
          .set({ ...productRow(input), version: sql`${products.version} + 1`, updatedAt: new Date() })
          .where(productWhere(storeId, id, expectedVersion))
          .returning({ id: products.id }),
        "product",
      ),
      db.delete(productFootprints).where(and(eq(productFootprints.storeId, storeId), eq(productFootprints.productId, id))),
      ...overrideInserts(storeId, id, input.overrides),
    ];
    await withStore(storeId, statements);
    return { status: "saved" as const };
  });
}

export function deleteProduct(storeId: string, id: string, expectedVersion: number): Promise<SaveOutcome<{ imagePath: string | null }>> {
  return attempt(async () => {
    const [images] = await withStore(storeId, [
      db.select({ path: products.imagePath }).from(products).where(and(eq(products.id, id), eq(products.storeId, storeId))),
      guarded(db.delete(products).where(productWhere(storeId, id, expectedVersion)).returning({ id: products.id }), "product"),
    ] as const);
    return { status: "saved" as const, imagePath: images[0]?.path ?? null };
  });
}

export function setProductStatus(
  storeId: string,
  id: string,
  expectedVersion: number,
  status: ProductStatus,
): Promise<SaveOutcome<{ version: number }>> {
  return attempt(async () => {
    await withStore(storeId, [
      guarded(
        db
          .update(products)
          .set({ status, version: sql`${products.version} + 1`, updatedAt: new Date() })
          .where(productWhere(storeId, id, expectedVersion))
          .returning({ id: products.id }),
        "product",
      ),
    ]);
    return { status: "saved" as const, version: expectedVersion + 1 };
  });
}

/**
 * The image is not a form field, so it does not bump the version: an edit form
 * left open while a photo uploads can still save.
 */
export async function setProductImage(storeId: string, id: string, path: string): Promise<SaveOutcome<{ previous: string | null }>> {
  const outcome = await attempt(async () => {
    const [previous] = await withStore(storeId, [
      db.select({ path: products.imagePath }).from(products).where(and(eq(products.id, id), eq(products.storeId, storeId))),
      guarded(
        db.update(products).set({ imagePath: path }).where(and(eq(products.id, id), eq(products.storeId, storeId))).returning({ id: products.id }),
        "product",
      ),
    ] as const);
    return { status: "saved" as const, previous: previous[0]?.path ?? null };
  });
  // No row to guard means no such product here: say so rather than "conflict".
  return outcome.status === "conflict" ? { status: "not-found" } : outcome;
}
