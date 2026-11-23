// Discarding a Quick Adjust draft against the dev database (0.7.0.9 spec §6.3).

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { planogramAdjustmentChanges, planogramAdjustments } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { loadAdjustments } from "./adjust-queries";
import { discardAdjustment, setChange } from "./adjust-write";
import { loadPlanogram } from "./queries";
import { openDraft, publishedPlanogram } from "./test-adjust-flow";

afterAll(dropStores);

const planogramOf = async (store: string, fixtureId: string) => (await loadPlanogram(store, fixtureId)).row;
const publish = (id: string) => db.update(planogramAdjustments).set({ state: "published", publishedAt: new Date(), publishedByName: "Sam" }).where(eq(planogramAdjustments.id, id));

describe("discardAdjustment", () => {
  it("deletes the draft and its changes, and leaves a published adjustment", async () => {
    const s = await publishedPlanogram("adjw-discard");
    const draft = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "empty" }, null);
    const current = (await loadAdjustments(s.store, (await planogramOf(s.store, s.f.fixtureId))?.id ?? "")).draft;
    expect(await discardAdjustment(s.store, s.f.fixtureId, draft.id, current?.version ?? 0)).toEqual({ status: "saved" });
    expect(await db.select().from(planogramAdjustmentChanges).where(eq(planogramAdjustmentChanges.storeId, s.store))).toEqual([]);

    const kept = await openDraft(s);
    await publish(kept.id);
    const next = await openDraft(s);
    expect(await discardAdjustment(s.store, s.f.fixtureId, next.id, next.version)).toEqual({ status: "saved" });
    expect((await db.select().from(planogramAdjustments).where(eq(planogramAdjustments.id, kept.id)))[0].state).toBe("published");
  });

  it("is a conflict when the draft changed or was published", async () => {
    const s = await publishedPlanogram("adjw-discard-stale");
    const draft = await openDraft(s);
    expect(await discardAdjustment(s.store, s.f.fixtureId, draft.id, draft.version + 3)).toEqual({ status: "conflict" });
    await publish(draft.id);
    expect(await discardAdjustment(s.store, s.f.fixtureId, draft.id, draft.version)).toEqual({ status: "conflict" });
  });
});
