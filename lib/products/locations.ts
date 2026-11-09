// Where products are (spec §7): floor cells and stockroom bins, labelled for
// Products and the location sheet. One store-scoped batch; the explicit store
// filter keeps it right on its own, and row-level security backs it up.

import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { fixtureFaces, fixtures, productLocations, stockroomBins } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";

import type { Presentation } from "./footprint";
import { locationDetail, locationLabel, type Cells } from "./location-label";
import { readCells } from "./location-words";

export type FloorPlace = { fixtureId: string; faceId: string; grid: { columns: number; rows: number }; cells: Cells };

export type LocationRow = {
  id: string;
  productId: string;
  presentation: Presentation;
  label: string;
  /** Feet and levels; "" for a bin. */
  detail: string;
  floor: FloorPlace | null;
};

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
        fixtureType: fixtures.type,
        setSide: fixtures.setSide,
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
      return [{ ...base, label, detail: "", floor: null }];
    }
    if (
      r.faceId === null || r.side === null || r.fixtureId === null || r.fixtureName === null || r.fixtureType === null ||
      r.columns === null || r.rows === null || r.col === null || r.row === null || r.colSpan === null || r.rowSpan === null
    ) {
      return [];
    }
    const cells = { col: r.col, row: r.row, colSpan: r.colSpan, rowSpan: r.rowSpan };
    const parts = {
      kind: "floor" as const, fixtureName: r.fixtureName, faceCount: r.faceCount, fixtureType: r.fixtureType,
      side: r.side, columns: r.columns, rows: r.rows, presentation: r.presentation,
      cells: readCells(cells, { columns: r.columns, rows: r.rows, setSide: r.setSide }),
    };
    return [
      {
        ...base,
        label: locationLabel(parts),
        detail: locationDetail(parts),
        floor: { fixtureId: r.fixtureId, faceId: r.faceId, grid: { columns: r.columns, rows: r.rows }, cells },
      },
    ];
  });
}
