// Stores, adjustments and changes for the Quick Adjust DB tests, written as the owner (like
// test-planograms.ts): setting up is not what the tests check.

import { db } from "@/db";
import { planogramAdjustmentChanges, planogramAdjustments } from "@/db/schema";
import { makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { addProduct, rawPlanogram } from "./test-planograms";

export type AdjustSetup = Awaited<ReturnType<typeof storeWithPlanogram>>;

/** A store with a planogram on a table, its product on the floor, and a second product to replace it with. */
export async function storeWithPlanogram(label: string) {
  const store = await makeStore(label);
  const f = await seedStoreFixtures(store);
  const planogramId = await rawPlanogram(store, f.fixtureId);
  const otherProductId = await addProduct(store, f.categoryId, "Slim Jean");
  return { store, f, planogramId, otherProductId };
}

export const adjustment = (s: AdjustSetup, over: Partial<typeof planogramAdjustments.$inferInsert> = {}) => ({
  storeId: s.store, planogramId: s.planogramId, basedOnVersion: 1, createdByName: "Sam", ...over,
});

/** What an ended adjustment needs: a state and a reason go together. */
export const ended = { state: "ended" as const, endedReason: "reverted", endedAt: new Date() };

export async function addAdjustment(s: AdjustSetup, over: Partial<typeof planogramAdjustments.$inferInsert> = {}): Promise<string> {
  const [row] = await db.insert(planogramAdjustments).values(adjustment(s, over)).returning({ id: planogramAdjustments.id });
  return row.id;
}

/** A replace of the store's product on its face's first cells; override to vary it. */
export const change = (s: AdjustSetup, adjustmentId: string, over: Partial<typeof planogramAdjustmentChanges.$inferInsert> = {}) => ({
  storeId: s.store, adjustmentId, kind: "replace" as const, faceId: s.f.faceId, targetProductId: s.f.productId, presentation: "folded" as const,
  col: 0, row: 0, colSpan: 2, rowSpan: 2, replacementProductId: s.otherProductId, replacementColSpan: 2, replacementRowSpan: 2, ...over,
});

/** Spread over a change to make it a tile left empty. */
export const empty = { kind: "empty" as const, replacementProductId: null, replacementColSpan: null, replacementRowSpan: null };
