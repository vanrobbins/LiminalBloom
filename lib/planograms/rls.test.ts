// Row-level security, composite FKs and insert-only history on the planogram
// tables, against the real dev database (like lib/db/with-store.test.ts).

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { fixtures, planogramPlacements, planograms, planogramVersions } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { rawPlanogram } from "./test-planograms";

afterAll(dropStores);

async function storeWithVersion(label: string) {
  const store = await makeStore(label);
  const f = await seedStoreFixtures(store);
  const planogramId = await rawPlanogram(store, f.fixtureId);
  await db.insert(planogramPlacements).values({
    id: randomUUID(), storeId: store, planogramId, faceId: f.faceId, productId: f.productId,
    presentation: "folded", col: 0, row: 0, colSpan: 2, rowSpan: 2,
  });
  const [version] = await db
    .insert(planogramVersions)
    .values({ storeId: store, planogramId, number: 1, publishedByName: "Van", placements: [] })
    .returning({ id: planogramVersions.id });
  return { store, f, planogramId, versionId: version.id };
}

describe("planogram tables under row-level security", () => {
  it("show only the scoped store's rows, even without a store filter", async () => {
    const a = await storeWithVersion("pg-rls-a");
    const b = await storeWithVersion("pg-rls-b");
    const [p, pl, v] = await withStore(a.store, [
      db.select().from(planograms),
      db.select().from(planogramPlacements),
      db.select().from(planogramVersions),
    ] as const);
    for (const rows of [p, pl, v]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.storeId === a.store)).toBe(true);
      expect(rows.some((r) => r.storeId === b.store)).toBe(false);
    }
  });

  it("cannot insert a planogram into another store", async () => {
    const a = await makeStore("pg-ins-a");
    const b = await storeWithVersion("pg-ins-b");
    await expect(
      withStore(a, [db.insert(planograms).values({ id: randomUUID(), storeId: b.store, fixtureId: b.f.fixtureId })]),
    ).rejects.toThrow();
  });

  it("lets the store role insert a version but never update or delete one", async () => {
    const a = await storeWithVersion("pg-insert-only");
    await withStore(a.store, [
      db.insert(planogramVersions).values({ storeId: a.store, planogramId: a.planogramId, number: 2, publishedByName: "Van", placements: [] }),
    ]);
    await expect(
      withStore(a.store, [db.update(planogramVersions).set({ summary: "rewritten" }).where(eq(planogramVersions.id, a.versionId))]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withStore(a.store, [db.delete(planogramVersions).where(eq(planogramVersions.id, a.versionId))]),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses a placement pointing at another store's product or face", async () => {
    const a = await storeWithVersion("pg-fk-a");
    const b = await storeWithVersion("pg-fk-b");
    const base = { storeId: a.store, planogramId: a.planogramId, presentation: "folded" as const, col: 3, row: 0, colSpan: 1, rowSpan: 1 };
    await expect(
      db.insert(planogramPlacements).values({ ...base, id: randomUUID(), faceId: a.f.faceId, productId: b.f.productId }),
    ).rejects.toThrow();
    await expect(
      db.insert(planogramPlacements).values({ ...base, id: randomUUID(), faceId: b.f.faceId, productId: a.f.productId }),
    ).rejects.toThrow();
  });

  it("deleting a fixture as the store role removes its planogram and versions", async () => {
    const a = await storeWithVersion("pg-cascade");
    await withStore(a.store, [db.delete(fixtures).where(eq(fixtures.id, a.f.fixtureId))]);
    expect(await db.select().from(planograms).where(eq(planograms.id, a.planogramId))).toEqual([]);
    expect(await db.select().from(planogramVersions).where(eq(planogramVersions.planogramId, a.planogramId))).toEqual([]);
  });
});
