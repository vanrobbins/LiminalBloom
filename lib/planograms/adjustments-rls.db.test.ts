// Quick Adjust's tables under row-level security, and what a delete takes with it (migration
// 0019, 0.7.0.9 spec §6.1), against the real dev database like rls.test.ts.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { fixtures, planogramAdjustmentChanges, planogramAdjustments, products } from "@/db/schema";
import { dbRefusal } from "@/lib/db/test-errors";
import { withStore } from "@/lib/db/with-store";
import { dropStores } from "@/lib/products/test-stores";

import { addAdjustment, adjustment, change, empty, storeWithPlanogram } from "./test-adjustments";

afterAll(dropStores);

const changesOf = (id: string) => db.select().from(planogramAdjustmentChanges).where(eq(planogramAdjustmentChanges.adjustmentId, id));
const adjustmentsOf = (id: string) => db.select().from(planogramAdjustments).where(eq(planogramAdjustments.id, id));

async function withChange(label: string) {
  const s = await storeWithPlanogram(label);
  const id = await addAdjustment(s);
  await db.insert(planogramAdjustmentChanges).values(change(s, id));
  return { s, id };
}

describe("row-level security", () => {
  it("shows the scoped store's rows only, on both tables, even without a store filter", async () => {
    const a = await withChange("rls-a");
    const b = await withChange("rls-b");
    const [adjustments, changes] = await withStore(a.s.store, [db.select().from(planogramAdjustments), db.select().from(planogramAdjustmentChanges)] as const);
    for (const rows of [adjustments, changes]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.storeId === a.s.store)).toBe(true);
      expect(rows.some((r) => r.storeId === b.s.store)).toBe(false);
    }
  });

  it("refuses to write another store's rows, and cannot update or delete them", async () => {
    const a = await withChange("rls-w-a");
    const b = await withChange("rls-w-b");
    const draft = { state: "ended" as const, endedReason: "reverted" };
    expect(await dbRefusal(withStore(a.s.store, [db.insert(planogramAdjustments).values(adjustment(b.s, draft))]))).toMatch(/row-level security policy for table "planogram_adjustments"/);
    expect(await dbRefusal(withStore(a.s.store, [db.insert(planogramAdjustmentChanges).values(change(b.s, b.id, { col: 8 }))]))).toMatch(/row-level security policy for table "planogram_adjustment_changes"/);
    await withStore(a.s.store, [db.update(planogramAdjustments).set({ createdByName: "Hacked" }).where(eq(planogramAdjustments.id, b.id)), db.delete(planogramAdjustmentChanges).where(eq(planogramAdjustmentChanges.adjustmentId, b.id))]);
    expect((await adjustmentsOf(b.id))[0].createdByName).toBe("Sam");
    expect(await changesOf(b.id)).toHaveLength(1);
  });

  it("lets the store role insert, update and delete its own rows", async () => {
    const s = await storeWithPlanogram("rls-own");
    const [[row]] = await withStore(s.store, [db.insert(planogramAdjustments).values(adjustment(s)).returning({ id: planogramAdjustments.id })] as const);
    await withStore(s.store, [db.insert(planogramAdjustmentChanges).values(change(s, row.id))]);
    await withStore(s.store, [db.update(planogramAdjustmentChanges).set({ pieceCount: 3 }).where(eq(planogramAdjustmentChanges.adjustmentId, row.id))]);
    expect((await changesOf(row.id))[0].pieceCount).toBe(3);
    await withStore(s.store, [db.delete(planogramAdjustments).where(eq(planogramAdjustments.id, row.id))]);
    expect(await changesOf(row.id)).toEqual([]);
  });
});

describe("cascades", () => {
  it("deleting a product removes the changes that target it or replace it with it, and keeps the adjustment", async () => {
    const s = await storeWithPlanogram("cas-product");
    const id = await addAdjustment(s);
    await db.insert(planogramAdjustmentChanges).values(change(s, id));
    await db.insert(planogramAdjustmentChanges).values({ ...change(s, id, { col: 4 }), ...empty });
    await db.delete(products).where(eq(products.id, s.otherProductId));
    expect((await changesOf(id)).map((c) => c.col)).toEqual([4]);
    await db.delete(products).where(eq(products.id, s.f.productId));
    expect(await changesOf(id)).toEqual([]);
    expect(await adjustmentsOf(id)).toHaveLength(1);
  });

  it("deleting a fixture removes its planogram's adjustments and their changes", async () => {
    const { s, id } = await withChange("cas-fixture");
    await withStore(s.store, [db.delete(fixtures).where(eq(fixtures.id, s.f.fixtureId))]);
    expect(await adjustmentsOf(id)).toEqual([]);
    expect(await changesOf(id)).toEqual([]);
  });

  it("deleting a store removes both tables' rows", async () => {
    const { s, id } = await withChange("cas-store");
    await db.delete(organization).where(eq(organization.id, s.store));
    expect(await adjustmentsOf(id)).toEqual([]);
    expect(await changesOf(id)).toEqual([]);
  });
});
