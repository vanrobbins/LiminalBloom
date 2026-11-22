// The product_locations rows a floor is: what a full publish writes from a draft, and a Quick Adjust
// publish or revert from a version's entries. One builder, so the two can't drift (0.7.0.9 spec §10).

import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { productLocations } from "@/db/schema";

import type { SnapshotEntry } from "./types";

/** What a floor row needs of a placement or a snapshot entry (a version from before layers has no depth). */
export type FloorEntry = Pick<SnapshotEntry, "productId" | "presentation" | "faceId" | "col" | "row" | "colSpan" | "rowSpan"> & { depth?: number };

export const floorRows = (storeId: string, entries: readonly FloorEntry[]) =>
  entries.map((e) => ({
    storeId,
    productId: e.productId,
    presentation: e.presentation,
    faceId: e.faceId,
    col: e.col,
    row: e.row,
    colSpan: e.colSpan,
    rowSpan: e.rowSpan,
    depth: e.depth ?? 0,
  }));

/** Rewrites these faces' floor: only this planogram's faces, so other fixtures and stockroom bins are never touched. */
export function floorStatements(storeId: string, faceIds: readonly string[], entries: readonly FloorEntry[]): BatchItem<"pg">[] {
  return [
    db.delete(productLocations).where(and(eq(productLocations.storeId, storeId), inArray(productLocations.faceId, [...faceIds]))),
    ...(entries.length ? [db.insert(productLocations).values(floorRows(storeId, entries))] : []),
  ];
}
