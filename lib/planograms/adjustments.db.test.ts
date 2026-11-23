// Quick Adjust's tables (migration 0019) against the real dev database: the partial unique
// indexes, the checks and the foreign keys (0.7.0.9 spec §6.1). Rows are set up as the owner.
// Row-level security and the cascades are in adjustments-rls.db.test.ts.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { planogramAdjustmentChanges, planogramAdjustments } from "@/db/schema";
import { dbRefusal } from "@/lib/db/test-errors";
import { dropStores } from "@/lib/products/test-stores";

import { addAdjustment, change, empty, ended, storeWithPlanogram } from "./test-adjustments";

afterAll(dropStores);

describe("planogram_adjustments", () => {
  it("lets a planogram have one draft and one published adjustment, and any number of ended ones", async () => {
    const s = await storeWithPlanogram("adj-states");
    await addAdjustment(s);
    await addAdjustment(s, { state: "published", publishedAt: new Date(), publishedByName: "Sam" });
    await addAdjustment(s, ended);
    await addAdjustment(s, { ...ended, endedReason: "superseded" });
    expect(await db.select().from(planogramAdjustments).where(eq(planogramAdjustments.planogramId, s.planogramId))).toHaveLength(4);
  });

  it("refuses a second draft, and a second published one", async () => {
    const s = await storeWithPlanogram("adj-unique");
    await addAdjustment(s);
    await addAdjustment(s, { state: "published" });
    expect(await dbRefusal(addAdjustment(s))).toMatch(/"planogram_adjustments_one_draft"/);
    expect(await dbRefusal(addAdjustment(s, { state: "published" }))).toMatch(/"planogram_adjustments_one_published"/);
  });

  it("frees the draft slot once the draft has ended", async () => {
    const s = await storeWithPlanogram("adj-free");
    const first = await addAdjustment(s);
    await db.update(planogramAdjustments).set(ended).where(eq(planogramAdjustments.id, first));
    await addAdjustment(s);
  });

  it("ties ended_reason to the ended state, and only to a known reason", async () => {
    const s = await storeWithPlanogram("adj-reason");
    const check = /violates check constraint "planogram_adjustments_ended_reason/;
    expect(await dbRefusal(addAdjustment(s, { state: "ended" }))).toMatch(check);
    expect(await dbRefusal(addAdjustment(s, { endedReason: "reverted" }))).toMatch(check);
    expect(await dbRefusal(addAdjustment(s, { state: "published", endedReason: "superseded" }))).toMatch(check);
    expect(await dbRefusal(addAdjustment(s, { ...ended, endedReason: "bored" }))).toMatch(/"planogram_adjustments_ended_reason_known"/);
    for (const endedReason of ["reverted", "superseded", "new_version"]) await addAdjustment(s, { ...ended, endedReason });
  });

  it("refuses a based-on version below 1, and a planogram from another store", async () => {
    const s = await storeWithPlanogram("adj-fk");
    const other = await storeWithPlanogram("adj-fk-other");
    expect(await dbRefusal(addAdjustment(s, { basedOnVersion: 0 }))).toMatch(/"planogram_adjustments_based_on"/);
    expect(await dbRefusal(addAdjustment(s, { planogramId: other.planogramId }))).toMatch(/"planogram_adjustments_planogram_fk"/);
  });
});

describe("planogram_adjustment_changes", () => {
  const insert = (values: ReturnType<typeof change>) => db.insert(planogramAdjustmentChanges).values(values);

  it("allows one change per target, and the same product elsewhere", async () => {
    const s = await storeWithPlanogram("chg-unique");
    const id = await addAdjustment(s);
    await insert(change(s, id));
    expect(await dbRefusal(insert({ ...change(s, id), ...empty }))).toMatch(/"planogram_adjustment_changes_target_unique"/);
    await insert({ ...change(s, id, { col: 4 }), ...empty });
    await insert({ ...change(s, id, { depth: 1 }), ...empty });
  });

  it("a replace needs a replacement with a footprint, and an empty has none", async () => {
    const s = await storeWithPlanogram("chg-kind");
    const id = await addAdjustment(s);
    const check = /"planogram_adjustment_changes_replacement"/;
    expect(await dbRefusal(insert({ ...change(s, id), replacementProductId: null }))).toMatch(check);
    expect(await dbRefusal(insert({ ...change(s, id), replacementRowSpan: null }))).toMatch(check);
    expect(await dbRefusal(insert({ ...change(s, id), kind: "empty" }))).toMatch(check);
    expect(await dbRefusal(insert({ ...change(s, id), ...empty, replacementColSpan: 2 }))).toMatch(check);
  });

  it("keeps cells, spans, pieces and depth in range", async () => {
    const s = await storeWithPlanogram("chg-ranges");
    const id = await addAdjustment(s);
    const ranges = /"planogram_adjustment_changes_ranges"/;
    for (const over of [{ col: 47, colSpan: 2 }, { colSpan: 0 }, { pieceCount: 100 }, { replacementColSpan: 49 }, { replacementRowSpan: 0 }]) {
      expect(await dbRefusal(insert(change(s, id, over)))).toMatch(ranges);
    }
    expect(await dbRefusal(insert(change(s, id, { depth: 99 })))).toMatch(/"planogram_adjustment_changes_depth"/);
  });

  it("refuses a face or product from another store", async () => {
    const s = await storeWithPlanogram("chg-store");
    const other = await storeWithPlanogram("chg-store-other");
    const id = await addAdjustment(s);
    expect(await dbRefusal(insert(change(s, id, { faceId: other.f.faceId })))).toMatch(/"planogram_adjustment_changes_face_fk"/);
    expect(await dbRefusal(insert(change(s, id, { targetProductId: other.f.productId })))).toMatch(/"planogram_adjustment_changes_target_fk"/);
    expect(await dbRefusal(insert(change(s, id, { replacementProductId: other.f.productId })))).toMatch(/"planogram_adjustment_changes_replacement_fk"/);
  });
});
