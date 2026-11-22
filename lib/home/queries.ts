// Home's own reads (spec 0.7.0.6 section 5.2): one store-scoped batch, so one Neon
// request with row-level security on. The explicit store filters keep each query
// right on its own; the composite (store_id, ...) joins keep a version, its
// planogram and its fixture in the same store.

import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { fixtures, planograms, planogramVersions, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { placeCondition } from "@/lib/products/queries";

import type { PublishRow } from "./types";

export const RECENT_PUBLISHES = 5;

export type HomeReads = { recentPublishes: PublishRow[]; productCount: number; unplacedCount: number };

export async function homeReads(storeId: string): Promise<HomeReads> {
  const count = sql<number>`count(*)::int`;
  const [publishes, all, unplaced] = await withStore(storeId, [
    db
      .select({
        fixtureId: fixtures.id,
        fixtureName: fixtures.name,
        version: planogramVersions.number,
        publisherName: planogramVersions.publishedByName,
        publishedAt: planogramVersions.publishedAt,
      })
      .from(planogramVersions)
      .innerJoin(planograms, and(eq(planograms.storeId, planogramVersions.storeId), eq(planograms.id, planogramVersions.planogramId)))
      .innerJoin(fixtures, and(eq(fixtures.storeId, planograms.storeId), eq(fixtures.id, planograms.fixtureId)))
      .where(eq(planogramVersions.storeId, storeId))
      .orderBy(desc(planogramVersions.publishedAt), desc(planogramVersions.number))
      .limit(RECENT_PUBLISHES),
    db.select({ n: count }).from(products).where(eq(products.storeId, storeId)),
    db.select({ n: count }).from(products).where(and(eq(products.storeId, storeId), placeCondition("unplaced"))),
  ] as const);
  return { recentPublishes: publishes, productCount: all[0]?.n ?? 0, unplacedCount: unplaced[0]?.n ?? 0 };
}
