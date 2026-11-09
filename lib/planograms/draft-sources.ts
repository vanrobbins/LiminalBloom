// What a draft is built from and checked against (spec §4.2–4.3): each
// product's footprints, and what is on the floor now. Store-scoped batches with
// explicit store filters; row-level security hides other stores even if one
// were missing.

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, productFootprints, productLocations, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { effectiveFootprint, PRESENTATIONS, type Overrides } from "@/lib/products/footprint";

import type { RestoredRow } from "./restore";
import type { ProductFit } from "./types";

export async function productFits(storeId: string, ids: readonly string[]): Promise<Map<string, ProductFit>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const [productRows, overrideRows] = await withStore(storeId, [
    db
      .select({
        id: products.id,
        name: products.name,
        styleNumber: products.styleNumber,
        hungColumns: productCategories.hungColumns,
        hungRows: productCategories.hungRows,
        foldedColumns: productCategories.foldedColumns,
        foldedRows: productCategories.foldedRows,
      })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(eq(products.storeId, storeId), inArray(products.id, unique))),
    db
      .select()
      .from(productFootprints)
      .where(and(eq(productFootprints.storeId, storeId), inArray(productFootprints.productId, unique))),
  ] as const);
  const fits = new Map<string, ProductFit>();
  for (const p of productRows) {
    const overrides: Overrides = {};
    for (const o of overrideRows.filter((r) => r.productId === p.id)) {
      overrides[o.presentation] = { columns: o.columns, rows: o.rows };
    }
    const [hung, folded] = PRESENTATIONS.map((presentation) => {
      const { columns, rows } = effectiveFootprint(p, overrides, presentation);
      return { columns, rows };
    });
    fits.set(p.id, { id: p.id, name: p.name, styleNumber: p.styleNumber, footprints: { hung, folded } });
  }
  return fits;
}

/** What's on these faces now, as draft rows (a never-published fixture's starting point, spec §4.2). */
export async function floorLocations(storeId: string, faceIds: readonly string[]): Promise<RestoredRow[]> {
  if (faceIds.length === 0) return [];
  const [rows] = await withStore(storeId, [
    db
      .select()
      .from(productLocations)
      .where(and(eq(productLocations.storeId, storeId), inArray(productLocations.faceId, [...faceIds]))),
  ] as const);
  return rows.flatMap((r) =>
    r.faceId === null || r.col === null || r.row === null || r.colSpan === null || r.rowSpan === null
      ? []
      : [{ productId: r.productId, faceId: r.faceId, presentation: r.presentation, col: r.col, row: r.row, colSpan: r.colSpan, rowSpan: r.rowSpan, pieceCount: 1 }],
  );
}
