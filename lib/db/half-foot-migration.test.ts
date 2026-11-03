// Migration 0010 (spec §2): every column value doubles, so every placement,
// location, footprint and published snapshot keeps its position in feet. The
// test runs the migration's own doubling block, scoped to a throwaway store by
// the lb.double_store setting, inside one batch (one transaction): the shared
// dev database's other stores are never touched (Review Focus 4).

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  fixtureFaces,
  planogramPlacements,
  planogramVersions,
  productCategories,
  productFootprints,
  productLocations,
} from "@/db/schema";
import { addFixture, rawPlanogram } from "@/lib/planograms/test-planograms";
import type { SnapshotEntry } from "@/lib/planograms/types";
import { databaseError } from "@/lib/products/errors";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

afterAll(dropStores);

function doublingStatements(): string[] {
  const text = readFileSync("db/migrations/0010_half_foot.sql", "utf8");
  const start = text.indexOf("-- double:start");
  const end = text.indexOf("-- double:end");
  if (start < 0 || end < start) throw new Error("0010_half_foot.sql has no double:start/double:end block.");
  return text
    .slice(start, end)
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/^--.*$/gm, "").trim())
    .filter(Boolean);
}

async function doubleStore(storeId: string): Promise<void> {
  const [first, ...rest] = doublingStatements().map((s) => db.execute(sql.raw(s)));
  if (!first) throw new Error("No doubling statements.");
  await db.batch([db.execute(sql`select set_config('lb.double_store', ${storeId}, true)`), first, ...rest]);
}

async function refusal(query: PromiseLike<unknown>): Promise<string | null> {
  try {
    await query;
    return null;
  } catch (error) {
    return databaseError(error)?.constraint ?? "unknown";
  }
}

/** A store at the old one-column-per-foot scale. */
async function oldScaleStore(label: string) {
  const store = await makeStore(label);
  const f = await seedStoreFixtures(store); // top face 6 × 3; location col 0, span 2
  await db.update(productCategories).set({ hungColumns: 1, foldedColumns: 2 }).where(eq(productCategories.id, f.categoryId));
  await db.insert(productFootprints).values({ storeId: store, productId: f.productId, presentation: "hung", columns: 3, rows: 4 });
  const wide = await addFixture(store, { name: "Wide wall", type: "wall_bay", faces: [{ side: "front", columns: 24, rows: 5 }] });
  const planogramId = await rawPlanogram(store, f.fixtureId);
  await db.insert(planogramPlacements).values({
    id: randomUUID(), storeId: store, planogramId, faceId: f.faceId, productId: f.productId,
    presentation: "folded", col: 1, row: 0, colSpan: 2, rowSpan: 2,
  });
  const entry: SnapshotEntry = {
    faceId: f.faceId, faceLabel: "Top", side: "top", fixtureId: f.fixtureId, fixtureName: "Front table 1",
    productId: f.productId, productName: "High-Rise Pant", styleNumber: f.styleNumber,
    presentation: "folded", col: 3, row: 1, colSpan: 2, rowSpan: 1, pieceCount: 4,
  };
  await db.insert(planogramVersions).values([
    { storeId: store, planogramId, number: 1, publishedByName: "Van", placements: [entry] },
    { storeId: store, planogramId, number: 2, publishedByName: "Van", placements: [] },
  ]);
  return { store, f, wideFaceId: wide.faceIds.front ?? "", planogramId };
}

describe("migration 0010: half-foot columns", () => {
  it("doubles every column value of the store it is given, and nothing else", async () => {
    const a = await oldScaleStore("hf-a");
    const b = await oldScaleStore("hf-b");
    await doubleStore(a.store);

    const face = async (id: string) => (await db.select().from(fixtureFaces).where(eq(fixtureFaces.id, id)))[0];
    // Old feet × 2 = new half-foot columns: the same place in feet.
    expect(await face(a.f.faceId)).toMatchObject({ columns: 12, rows: 3 });
    expect(await face(a.wideFaceId)).toMatchObject({ columns: 48, rows: 5 });
    const [category] = await db.select().from(productCategories).where(eq(productCategories.id, a.f.categoryId));
    expect(category).toMatchObject({ hungColumns: 2, foldedColumns: 4, hungRows: 3, foldedRows: 2 });
    const [footprint] = await db.select().from(productFootprints).where(eq(productFootprints.productId, a.f.productId));
    expect(footprint).toMatchObject({ columns: 6, rows: 4 });
    const [location] = await db.select().from(productLocations).where(eq(productLocations.id, a.f.locationId));
    expect(location).toMatchObject({ col: 0, colSpan: 4, row: 0, rowSpan: 2 });
    const [placement] = await db.select().from(planogramPlacements).where(eq(planogramPlacements.planogramId, a.planogramId));
    expect(placement).toMatchObject({ col: 2, colSpan: 4, row: 0, rowSpan: 2 });
    const versions = await db.select().from(planogramVersions).where(eq(planogramVersions.planogramId, a.planogramId)).orderBy(planogramVersions.number);
    expect(versions[0].placements[0]).toMatchObject({ col: 6, colSpan: 4, row: 1, rowSpan: 1, pieceCount: 4 });
    expect(versions[1].placements).toEqual([]);

    // The other store is exactly as it was.
    expect(await face(b.f.faceId)).toMatchObject({ columns: 6 });
    const [untouched] = await db.select().from(productLocations).where(eq(productLocations.id, b.f.locationId));
    expect(untouched).toMatchObject({ col: 0, colSpan: 2 });
  });

  it("allows columns up to 48 and refuses past them; rows stay at 24", async () => {
    const { store, f, planogramId } = await oldScaleStore("hf-bounds");
    const place = (col: number, colSpan: number) =>
      db.insert(planogramPlacements).values({
        id: randomUUID(), storeId: store, planogramId, faceId: f.faceId, productId: f.productId,
        presentation: "hung", col, row: 0, colSpan, rowSpan: 1,
      });
    expect(await refusal(place(46, 2))).toBeNull();
    expect(await refusal(place(47, 2))).toBe("planogram_placements_ranges");
    const locate = (col: number, colSpan: number) =>
      db.insert(productLocations).values({ storeId: store, productId: f.productId, presentation: "hung", faceId: f.faceId, col, row: 0, colSpan, rowSpan: 1 });
    expect(await refusal(locate(47, 2))).toBe("product_locations_ranges");
    const face = (columns: number, rows: number, side: "front" | "back") =>
      db.insert(fixtureFaces).values({ id: randomUUID(), storeId: store, fixtureId: f.fixtureId, side, columns, rows });
    expect(await refusal(face(49, 3, "front"))).toBe("fixture_faces_grid_range");
    expect(await refusal(face(48, 25, "front"))).toBe("fixture_faces_grid_range");
    expect(await refusal(face(48, 24, "back"))).toBeNull();
  });
});
