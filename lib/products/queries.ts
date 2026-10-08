// The product library's reads (spec §7), each in one store-scoped batch. The
// explicit store filters keep the queries right on their own; row-level
// security hides other stores even if one were missing.

import "server-only";

import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  fixtureFaces,
  fixtures,
  productCategories,
  productFootprints,
  productLocations,
  products,
  stockroomBins,
} from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import type { ProductStatus } from "@/lib/product-status";

import type { CategoryDefaults, Overrides, Presentation } from "./footprint";
import { locationLabel, type Cells } from "./location-label";
import type { Place, SearchInput } from "./schemas";

export const SEARCH_LIMIT = 30;
// pg_trgm's default (0.6) misses "hi rise pnt", which scores 0.533 against "high-rise pant ...". At 0.3
// looser matches come through too ("high rise pant" scores 0.333 against "Rise Tee"), ranked below the
// closer ones.
export const WORD_SIMILARITY_THRESHOLD = "0.3";

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Fewer than two characters, or no letter or digit, browses instead. */
export function isTextQuery(q: string): boolean {
  return q.length >= 2 && /[\p{L}\p{N}]/u.test(q);
}

/** The file name only: it changes whenever the image does, so it busts the browser cache. */
export function imageKeyOf(path: string | null): string | null {
  return path ? path.slice(path.lastIndexOf("/") + 1) : null;
}

export type ProductRow = {
  id: string;
  name: string;
  styleNumber: string;
  color: string;
  sizeRange: string;
  status: ProductStatus;
  version: number;
  categoryId: string;
  categoryName: string;
  imageKey: string | null;
};

export type FloorPlace = { fixtureId: string; faceId: string; grid: { columns: number; rows: number }; cells: Cells };

export type LocationRow = {
  id: string;
  productId: string;
  presentation: Presentation;
  label: string;
  spanLabel: string;
  floor: FloorPlace | null;
};

export type SearchResult = ProductRow & { locations: LocationRow[] };

export type CategoryRow = CategoryDefaults & { id: string; name: string; version: number; productCount: number };

export type ProductDetail = { product: ProductRow; category: CategoryRow; overrides: Overrides; locations: LocationRow[] };

const productColumns = {
  id: products.id,
  name: products.name,
  styleNumber: products.styleNumber,
  color: products.color,
  sizeRange: products.sizeRange,
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

export async function searchProducts(storeId: string, input: SearchInput, limit = SEARCH_LIMIT): Promise<ProductRow[]> {
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
  const [, rows] = await withStore(storeId, [
    db.execute(sql`select set_config('pg_trgm.word_similarity_threshold', ${WORD_SIMILARITY_THRESHOLD}, true)`),
    db
      .select(productColumns)
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(...conditions))
      .orderBy(...(isText ? [desc(score), asc(products.name)] : [asc(products.name)]))
      .limit(limit),
  ] as const);
  return rows.map(toRow);
}

export async function locationsFor(storeId: string, productIds: readonly string[]): Promise<LocationRow[]> {
  if (productIds.length === 0) return [];
  const [rows] = await withStore(storeId, [
    db
      .select({
        id: productLocations.id,
        productId: productLocations.productId,
        presentation: productLocations.presentation,
        col: productLocations.col,
        row: productLocations.row,
        colSpan: productLocations.colSpan,
        rowSpan: productLocations.rowSpan,
        faceId: fixtureFaces.id,
        side: fixtureFaces.side,
        columns: fixtureFaces.columns,
        rows: fixtureFaces.rows,
        fixtureId: fixtures.id,
        fixtureName: fixtures.name,
        faceCount: sql<number>`(select count(*)::int from ${fixtureFaces} f2 where f2.fixture_id = ${fixtures.id})`,
        binCode: stockroomBins.code,
      })
      .from(productLocations)
      .leftJoin(fixtureFaces, eq(fixtureFaces.id, productLocations.faceId))
      .leftJoin(fixtures, eq(fixtures.id, fixtureFaces.fixtureId))
      .leftJoin(stockroomBins, eq(stockroomBins.id, productLocations.binId))
      .where(and(eq(productLocations.storeId, storeId), inArray(productLocations.productId, [...productIds])))
      // Floor before stockroom, then by fixture and cell, so the first one is the one to show.
      .orderBy(sql`${productLocations.binId} is not null`, asc(fixtures.name), asc(productLocations.row), asc(productLocations.col)),
  ] as const);

  return rows.flatMap((r): LocationRow[] => {
    const base = { id: r.id, productId: r.productId, presentation: r.presentation };
    if (r.binCode !== null) {
      const label = locationLabel({ kind: "bin", code: r.binCode });
      return [{ ...base, label, spanLabel: label, floor: null }];
    }
    if (
      r.faceId === null || r.side === null || r.fixtureId === null || r.fixtureName === null ||
      r.columns === null || r.rows === null || r.col === null || r.row === null || r.colSpan === null || r.rowSpan === null
    ) {
      return [];
    }
    const cells = { col: r.col, row: r.row, colSpan: r.colSpan, rowSpan: r.rowSpan };
    const parts = { kind: "floor" as const, fixtureName: r.fixtureName, side: r.side, faceCount: r.faceCount, cells };
    return [
      {
        ...base,
        label: locationLabel(parts),
        spanLabel: locationLabel(parts, { span: true }),
        floor: { fixtureId: r.fixtureId, faceId: r.faceId, grid: { columns: r.columns, rows: r.rows }, cells },
      },
    ];
  });
}

export async function search(storeId: string, input: SearchInput): Promise<SearchResult[]> {
  const rows = await searchProducts(storeId, input);
  const locations = await locationsFor(storeId, rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, locations: locations.filter((l) => l.productId === row.id) }));
}

const categoryColumns = {
  id: productCategories.id,
  name: productCategories.name,
  hungColumns: productCategories.hungColumns,
  hungRows: productCategories.hungRows,
  foldedColumns: productCategories.foldedColumns,
  foldedRows: productCategories.foldedRows,
  stackLimit: productCategories.stackLimit,
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
  for (const f of footprintRows) overrides[f.presentation] = { columns: f.columns, rows: f.rows, stackLimit: f.stackLimit };
  return { product: toRow(product), category, overrides, locations: await locationsFor(storeId, [productId]) };
}

export async function productImagePath(storeId: string, productId: string): Promise<string | null> {
  const [rows] = await withStore(storeId, [
    db.select({ path: products.imagePath }).from(products).where(and(eq(products.storeId, storeId), eq(products.id, productId))),
  ] as const);
  return rows[0]?.path ?? null;
}
