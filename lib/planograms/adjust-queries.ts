// Quick Adjust reads (0.7.0.9 spec §6.3, §6.4), each in a store-scoped batch with explicit store filters;
// row-level security hides other stores even if one were missing.

import "server-only";

import { and, asc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { fixtures, planogramAdjustmentChanges as changes, planogramAdjustments as adjustments, planograms, productCategories, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";

import type { AdjustChange, AdjustmentState, Adjustments, ChangeRow } from "./adjust";
import type { Candidate } from "./adjust-suggest";
import { productFits } from "./draft-sources";

/** The two reads, for a caller that batches them with its own (loadPlanogram). */
export function adjustmentQueries(storeId: string, planogramId: string) {
  return [
    db
      .select({
        id: adjustments.id,
        planogramId: adjustments.planogramId,
        state: adjustments.state,
        basedOnVersion: adjustments.basedOnVersion,
        version: adjustments.version,
        createdByName: adjustments.createdByName,
        publishedAt: adjustments.publishedAt,
        publishedByName: adjustments.publishedByName,
      })
      .from(adjustments)
      .where(and(eq(adjustments.storeId, storeId), eq(adjustments.planogramId, planogramId), ne(adjustments.state, "ended"))),
    db
      .select({
        id: changes.id,
        adjustmentId: changes.adjustmentId,
        version: changes.version,
        kind: changes.kind,
        faceId: changes.faceId,
        targetProductId: changes.targetProductId,
        presentation: changes.presentation,
        col: changes.col,
        row: changes.row,
        colSpan: changes.colSpan,
        rowSpan: changes.rowSpan,
        depth: changes.depth,
        pieceCount: changes.pieceCount,
        replacementProductId: changes.replacementProductId,
        replacementColSpan: changes.replacementColSpan,
        replacementRowSpan: changes.replacementRowSpan,
        replacementName: products.name,
        replacementStyle: products.styleNumber,
      })
      .from(changes)
      .innerJoin(adjustments, and(eq(adjustments.storeId, changes.storeId), eq(adjustments.id, changes.adjustmentId)))
      .leftJoin(products, and(eq(products.storeId, changes.storeId), eq(products.id, changes.replacementProductId)))
      .where(and(eq(changes.storeId, storeId), eq(adjustments.planogramId, planogramId), ne(adjustments.state, "ended")))
      .orderBy(asc(changes.createdAt), asc(changes.id)),
  ] as const;
}

type AdjustmentRow = Awaited<ReturnType<ReturnType<typeof adjustmentQueries>[0]["execute"]>>[number];
type ChangeQueryRow = Awaited<ReturnType<ReturnType<typeof adjustmentQueries>[1]["execute"]>>[number];

function toChange(r: ChangeQueryRow): ChangeRow {
  const target = { faceId: r.faceId, productId: r.targetProductId, presentation: r.presentation, col: r.col, row: r.row, colSpan: r.colSpan, rowSpan: r.rowSpan, depth: r.depth };
  const base = { id: r.id, version: r.version };
  if (r.kind === "replace" && r.replacementProductId && r.replacementColSpan && r.replacementRowSpan) {
    const replacement = { productId: r.replacementProductId, productName: r.replacementName ?? "", styleNumber: r.replacementStyle ?? "", colSpan: r.replacementColSpan, rowSpan: r.replacementRowSpan };
    return { ...base, kind: "replace", target, replacement, pieceCount: r.pieceCount } satisfies AdjustChange & typeof base;
  }
  return { ...base, kind: "empty", target };
}

export function toAdjustments(adjustmentRows: readonly AdjustmentRow[], changeRows: readonly ChangeQueryRow[]): Adjustments {
  const build = (r: AdjustmentRow): AdjustmentState => ({
    id: r.id,
    planogramId: r.planogramId,
    state: r.state === "published" ? "published" : "draft",
    basedOnVersion: r.basedOnVersion,
    version: r.version,
    createdByName: r.createdByName,
    publishedAt: r.publishedAt,
    publishedByName: r.publishedByName,
    changes: changeRows.filter((c) => c.adjustmentId === r.id).map(toChange),
  });
  const rows = adjustmentRows.map(build);
  return { draft: rows.find((a) => a.state === "draft") ?? null, published: rows.find((a) => a.state === "published") ?? null };
}

export async function loadAdjustments(storeId: string, planogramId: string): Promise<Adjustments> {
  const [adjustmentRows, changeRows] = await withStore(storeId, adjustmentQueries(storeId, planogramId));
  return toAdjustments(adjustmentRows, changeRows);
}

/** Where a published Quick Adjust took this product off the floor: the planogram's fixture, for the location sheet. */
export async function adjustedOff(storeId: string, productId: string): Promise<{ fixtureId: string; fixtureName: string }[]> {
  const [rows] = await withStore(storeId, [
    db
      .selectDistinct({ fixtureId: planograms.fixtureId, fixtureName: fixtures.name })
      .from(changes)
      .innerJoin(adjustments, and(eq(adjustments.storeId, changes.storeId), eq(adjustments.id, changes.adjustmentId)))
      .innerJoin(planograms, and(eq(planograms.storeId, adjustments.storeId), eq(planograms.id, adjustments.planogramId)))
      .innerJoin(fixtures, and(eq(fixtures.storeId, planograms.storeId), eq(fixtures.id, planograms.fixtureId)))
      .where(and(eq(changes.storeId, storeId), eq(changes.targetProductId, productId), eq(adjustments.state, "published")))
      .orderBy(asc(fixtures.name)),
  ] as const);
  return rows;
}

/** Products with their footprints and status (a sold out one is not eligible; the caller decides); `categoryId` narrows to one category, `ids` to these. */
export async function loadCandidates(storeId: string, where: { categoryId?: string; ids?: readonly string[] }): Promise<Candidate[]> {
  const [rows] = await withStore(storeId, [
    db
      .select({ id: products.id, categoryId: products.categoryId, color: products.color, swatch: products.swatch, status: products.status })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(
        and(
          eq(products.storeId, storeId),
          where.categoryId ? eq(products.categoryId, where.categoryId) : undefined,
          where.ids ? inArray(products.id, [...where.ids]) : undefined,
        ),
      ),
  ] as const);
  const fits = await productFits(storeId, rows.map((r) => r.id));
  return rows.flatMap(({ id, ...look }) => {
    const fit = fits.get(id);
    return fit ? [{ ...fit, ...look }] : [];
  });
}

/** The look of one product (the tile being replaced): its category, colour and swatch. */
export async function productLook(storeId: string, productId: string): Promise<{ categoryId: string; color: string; swatch: string | null } | null> {
  const [rows] = await withStore(storeId, [
    db.select({ categoryId: products.categoryId, color: products.color, swatch: products.swatch }).from(products).where(and(eq(products.storeId, storeId), eq(products.id, productId))),
  ] as const);
  return rows[0] ?? null;
}
