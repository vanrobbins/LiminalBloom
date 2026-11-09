// The product library's reads (spec §7), each in one store-scoped batch. The
// explicit store filters keep the queries right on their own; row-level
// security hides other stores even if one were missing.

import "server-only";

import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, productFootprints, productLocations, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import type { ProductStatus } from "@/lib/product-status";

import type { CategoryDefaults, Overrides } from "./footprint";
import { locationsFor, type LocationRow } from "./locations";
import type { Place, SearchInput, Sort, Texture } from "./schemas";
import { effectiveSort, isTextQuery, normalizeQuery } from "./search-params";

export const SEARCH_LIMIT = 30;
// pg_trgm's default (0.6) misses "hi rise pnt", which scores 0.533 against "high-rise pant ...". At 0.3
// looser matches come through too ("high rise pant" scores 0.333 against "Rise Tee"), ranked below the
// closer ones.
export const WORD_SIMILARITY_THRESHOLD = "0.3";

// Pure, so the screen can use them too; re-exported for the callers here.
export { isTextQuery, normalizeQuery };

/** The file name only: it changes whenever the image does, so it busts the browser cache. */
export function imageKeyOf(path: string | null): string | null {
  return path ? path.slice(path.lastIndexOf("/") + 1) : null;
}

export type ProductRow = {
  id: string;
  name: string;
  styleNumber: string;
  color: string;
  /** The product's own size range, else its category's (Week 6.5 spec §3.4); "" means none. */
  sizeRange: string;
  /** Whether `sizeRange` is the product's own rather than inherited. */
  sizeIsOwn: boolean;
  /** The drawing's own colour, or null to match the colour word. */
  swatch: string | null;
  texture: Texture;
  status: ProductStatus;
  version: number;
  categoryId: string;
  categoryName: string;
  imageKey: string | null;
};

export type SearchResult = ProductRow & { locations: LocationRow[] };
export type SearchPage = { results: SearchResult[]; total: number };

export type CategoryRow = CategoryDefaults & { id: string; name: string; sizeRange: string; version: number; productCount: number };

export type ProductDetail = { product: ProductRow; category: CategoryRow; overrides: Overrides; locations: LocationRow[] };

const productColumns = {
  id: products.id,
  name: products.name,
  styleNumber: products.styleNumber,
  color: products.color,
  sizeRange: sql<string>`coalesce(${products.sizeRange}, ${productCategories.sizeRange})`,
  sizeIsOwn: sql<boolean>`${products.sizeRange} is not null`,
  swatch: products.swatch,
  texture: products.texture,
  status: products.status,
  version: products.version,
  categoryId: products.categoryId,
  categoryName: productCategories.name,
  imagePath: products.imagePath,
};

function toRow({ imagePath, ...rest }: Omit<ProductRow, "imageKey"> & { imagePath: string | null }): ProductRow {
  return { ...rest, imageKey: imageKeyOf(imagePath) };
}

const located = (where: SQL) =>
  sql`exists (select 1 from ${productLocations} where ${productLocations.productId} = ${products.id} and ${where})`;

function placeCondition(place: Place): SQL {
  if (place === "floor") return located(sql`${productLocations.faceId} is not null`);
  if (place === "stockroom") return located(sql`${productLocations.binId} is not null`);
  return sql`not ${located(sql`true`)}`;
}

// The total is a window count taken before the limit, so one query answers both.
async function searchRows(storeId: string, input: SearchInput, limit: number): Promise<{ rows: ProductRow[]; total: number }> {
  const q = normalizeQuery(input.q);
  const isText = isTextQuery(q);
  const categoryName = sql`lower(${productCategories.name})`;

  const conditions: SQL[] = [eq(products.storeId, storeId)];
  // Parameters, never string-built: quotes, % and _ are just characters here.
  if (isText) conditions.push(sql`(${q} <% ${products.searchText} or ${q} <% ${categoryName})`);
  if (input.categoryIds.length > 0) conditions.push(inArray(products.categoryId, input.categoryIds));
  if (input.colors.length > 0) {
    conditions.push(inArray(sql`lower(${products.color})`, input.colors.map((c) => c.toLowerCase())));
  }
  if (input.statuses.length > 0) conditions.push(inArray(products.status, input.statuses));
  if (input.places.length > 0) conditions.push(or(...input.places.map(placeCondition)) as SQL);

  const score = sql`greatest(word_similarity(${q}, ${products.searchText}), word_similarity(${q}, ${categoryName}))`;
  // Ties break on name, then id, so Show more never repeats or skips a card.
  const first: Record<Sort, SQL[]> = {
    match: [desc(score)],
    name: [],
    updated: [desc(products.updatedAt)],
    added: [desc(products.createdAt)],
  };
  const [, rows] = await withStore(storeId, [
    db.execute(sql`select set_config('pg_trgm.word_similarity_threshold', ${WORD_SIMILARITY_THRESHOLD}, true)`),
    db
      .select({ ...productColumns, total: sql<number>`(count(*) over ())::int` })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(...conditions))
      .orderBy(...first[effectiveSort(input)], asc(products.name), asc(products.id))
      .limit(limit)
      .offset(input.offset),
  ] as const);
  return { rows: rows.map(({ total, ...row }) => (void total, toRow(row))), total: rows[0]?.total ?? 0 };
}

export async function searchProducts(storeId: string, input: SearchInput, limit = SEARCH_LIMIT): Promise<ProductRow[]> {
  return (await searchRows(storeId, input, limit)).rows;
}

export async function search(storeId: string, input: SearchInput, limit = SEARCH_LIMIT): Promise<SearchPage> {
  const { rows, total } = await searchRows(storeId, input, limit);
  const locations = await locationsFor(storeId, rows.map((r) => r.id));
  return { results: rows.map((row) => ({ ...row, locations: locations.filter((l) => l.productId === row.id) })), total };
}

const categoryColumns = {
  id: productCategories.id,
  name: productCategories.name,
  hungColumns: productCategories.hungColumns,
  hungRows: productCategories.hungRows,
  foldedColumns: productCategories.foldedColumns,
  foldedRows: productCategories.foldedRows,
  sizeRange: productCategories.sizeRange,
  version: productCategories.version,
  productCount: sql<number>`(select count(*)::int from ${products} p2 where p2.category_id = product_categories.id)`,
};

export async function listCategories(storeId: string): Promise<CategoryRow[]> {
  const [rows] = await withStore(storeId, [
    db
      .select(categoryColumns)
      .from(productCategories)
      .where(eq(productCategories.storeId, storeId))
      .orderBy(asc(sql`lower(${productCategories.name})`)),
  ] as const);
  return rows;
}

export async function listColors(storeId: string): Promise<string[]> {
  const [rows] = await withStore(storeId, [
    db.selectDistinct({ color: products.color }).from(products).where(eq(products.storeId, storeId)).orderBy(asc(products.color)),
  ] as const);
  return rows.map((r) => r.color);
}

export async function productDetail(storeId: string, productId: string): Promise<ProductDetail | null> {
  const [productRows, categoryRows, footprintRows] = await withStore(storeId, [
    db
      .select(productColumns)
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(eq(products.storeId, storeId), eq(products.id, productId))),
    db
      .select(categoryColumns)
      .from(productCategories)
      .innerJoin(products, eq(products.categoryId, productCategories.id))
      .where(and(eq(products.storeId, storeId), eq(products.id, productId))),
    db
      .select()
      .from(productFootprints)
      .where(and(eq(productFootprints.storeId, storeId), eq(productFootprints.productId, productId))),
  ] as const);
  const product = productRows[0];
  const category = categoryRows[0];
  if (!product || !category) return null;
  const overrides: Overrides = {};
  for (const f of footprintRows) overrides[f.presentation] = { columns: f.columns, rows: f.rows };
  return { product: toRow(product), category, overrides, locations: await locationsFor(storeId, [productId]) };
}

export async function productImagePath(storeId: string, productId: string): Promise<string | null> {
  const [rows] = await withStore(storeId, [
    db.select({ path: products.imagePath }).from(products).where(and(eq(products.storeId, storeId), eq(products.id, productId))),
  ] as const);
  return rows[0]?.path ?? null;
}
