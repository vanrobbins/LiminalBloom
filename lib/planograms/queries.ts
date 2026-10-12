// Planogram reads (spec §4–5), each in a store-scoped batch with explicit store
// filters; row-level security hides other stores even if one were missing.

import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  planogramPlacements,
  planograms,
  planogramVersions,
  productCategories,
  productFootprints,
  productLocations,
  products,
} from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { effectiveFootprint, PRESENTATIONS, type Overrides } from "@/lib/products/footprint";
import { imageKeyOf } from "@/lib/products/queries";

import type { PlanogramSummary } from "./list";
import type { RestoredRow } from "./restore";
import { parseSnapshot } from "./snapshot";
import type { DraftState, PlacementView, ProductFit, SnapshotEntry } from "./types";

export type PlanogramRow = {
  id: string;
  fixtureId: string;
  basedOnVersion: number | null;
  publishedVersion: number | null;
  hasDraft: boolean;
  dueDate: string | null;
  version: number;
};
export type PublishedVersion = { number: number; publishedAt: Date; publishedByName: string; summary: string | null; placements: SnapshotEntry[] };
export type PlanogramState = { row: PlanogramRow | null; draft: DraftState | null; latest: PublishedVersion | null };

const rowColumns = {
  id: planograms.id,
  fixtureId: planograms.fixtureId,
  basedOnVersion: planograms.basedOnVersion,
  publishedVersion: planograms.publishedVersion,
  hasDraft: planograms.hasDraft,
  dueDate: planograms.dueDate,
  version: planograms.version,
};

const versionColumns = {
  number: planogramVersions.number,
  publishedAt: planogramVersions.publishedAt,
  publishedByName: planogramVersions.publishedByName,
  summary: planogramVersions.summary,
  placements: planogramVersions.placements,
};

const toVersion = (r: Omit<PublishedVersion, "placements"> & { placements: unknown }): PublishedVersion => ({
  ...r,
  placements: parseSnapshot(r.placements),
});

function draftQuery(storeId: string, planogramId: string) {
  return db
    .select({
      id: planogramPlacements.id,
      faceId: planogramPlacements.faceId,
      productId: planogramPlacements.productId,
      presentation: planogramPlacements.presentation,
      col: planogramPlacements.col,
      row: planogramPlacements.row,
      colSpan: planogramPlacements.colSpan,
      rowSpan: planogramPlacements.rowSpan,
      pieceCount: planogramPlacements.pieceCount,
      version: planogramPlacements.version,
      productName: products.name,
      styleNumber: products.styleNumber,
      imagePath: products.imagePath,
      categoryName: productCategories.name,
      // The folded stack limit whatever the presentation (only folded product
      // stacks), so switching hung → folded is checked against the right one.
      // The product's own folded footprint, else its category's.
      stackLimit: sql<number>`coalesce((select pf.stack_limit from ${productFootprints} pf where pf.product_id = ${planogramPlacements.productId} and pf.presentation = 'folded'), ${productCategories.stackLimit})`,
    })
    .from(planogramPlacements)
    .innerJoin(products, eq(products.id, planogramPlacements.productId))
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(eq(planogramPlacements.storeId, storeId), eq(planogramPlacements.planogramId, planogramId)))
    .orderBy(asc(planogramPlacements.row), asc(planogramPlacements.col), asc(planogramPlacements.id));
}

export async function planogramSummaries(storeId: string): Promise<PlanogramSummary[]> {
  const [rows] = await withStore(storeId, [
    db
      .select({
        fixtureId: planograms.fixtureId,
        publishedVersion: planograms.publishedVersion,
        hasDraft: planograms.hasDraft,
        dueDate: planograms.dueDate,
        publishedAt: planogramVersions.publishedAt,
      })
      .from(planograms)
      .leftJoin(
        planogramVersions,
        and(eq(planogramVersions.planogramId, planograms.id), eq(planogramVersions.number, planograms.publishedVersion)),
      )
      .where(eq(planograms.storeId, storeId)),
  ] as const);
  return rows;
}

export async function loadPlanogram(storeId: string, fixtureId: string): Promise<PlanogramState> {
  const [rows] = await withStore(storeId, [
    db.select(rowColumns).from(planograms).where(and(eq(planograms.storeId, storeId), eq(planograms.fixtureId, fixtureId))),
  ] as const);
  const row = rows[0] ?? null;
  if (!row) return { row: null, draft: null, latest: null };
  const [draftRows, versionRows] = await withStore(storeId, [
    draftQuery(storeId, row.id),
    db
      .select(versionColumns)
      .from(planogramVersions)
      .where(
        and(
          eq(planogramVersions.storeId, storeId),
          eq(planogramVersions.planogramId, row.id),
          eq(planogramVersions.number, row.publishedVersion ?? 0),
        ),
      ),
  ] as const);
  const placements: PlacementView[] = draftRows.map(({ imagePath, ...p }) => ({ ...p, imageKey: imageKeyOf(imagePath) }));
  return {
    row,
    draft: row.hasDraft ? { planogramVersion: row.version, placements } : null,
    latest: versionRows[0] ? toVersion(versionRows[0]) : null,
  };
}

export async function draftState(storeId: string, fixtureId: string): Promise<DraftState | null> {
  return (await loadPlanogram(storeId, fixtureId)).draft;
}

export async function loadVersion(storeId: string, planogramId: string, number: number): Promise<PublishedVersion | null> {
  const [rows] = await withStore(storeId, [
    db
      .select(versionColumns)
      .from(planogramVersions)
      .where(and(eq(planogramVersions.storeId, storeId), eq(planogramVersions.planogramId, planogramId), eq(planogramVersions.number, number))),
  ] as const);
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function listVersions(storeId: string, planogramId: string): Promise<PublishedVersion[]> {
  const [rows] = await withStore(storeId, [
    db
      .select(versionColumns)
      .from(planogramVersions)
      .where(and(eq(planogramVersions.storeId, storeId), eq(planogramVersions.planogramId, planogramId)))
      .orderBy(desc(planogramVersions.number)),
  ] as const);
  return rows.map(toVersion);
}

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
        stackLimit: productCategories.stackLimit,
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
      overrides[o.presentation] = { columns: o.columns, rows: o.rows, stackLimit: o.stackLimit };
    }
    const [hung, folded] = PRESENTATIONS.map((presentation) => {
      const { columns, rows, stackLimit } = effectiveFootprint(p, overrides, presentation);
      return { columns, rows, stackLimit };
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
