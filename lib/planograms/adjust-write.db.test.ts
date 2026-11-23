// Opening, changing and discarding a Quick Adjust draft against the dev database (0.7.0.9 spec §6.3).

import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { planogramAdjustmentChanges, planogramAdjustments, planograms, productFootprints, products } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { loadAdjustments } from "./adjust-queries";
import { openAdjustment, setChange } from "./adjust-write";
import { loadPlanogram } from "./queries";
import { openDraft, publishedPlanogram } from "./test-adjust-flow";

afterAll(dropStores);

// Lets a test change the database just before a batch runs (between a write's load and its batch).
const hooks = vi.hoisted(() => ({ beforeBatch: null as null | ((size: number) => Promise<void>) }));
vi.mock("@/lib/db/with-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/with-store")>();
  async function withStore<Q extends Parameters<typeof actual.withStore>[1]>(storeId: string, queries: Q) {
    await hooks.beforeBatch?.(queries.length);
    return actual.withStore(storeId, queries);
  }
  return { withStore };
});
afterEach(() => {
  hooks.beforeBatch = null;
});

const planogramOf = async (store: string, fixtureId: string) => (await loadPlanogram(store, fixtureId)).row;
const changesOf = (adjustmentId: string) => db.select().from(planogramAdjustmentChanges).where(eq(planogramAdjustmentChanges.adjustmentId, adjustmentId));
const publish = (id: string) => db.update(planogramAdjustments).set({ state: "published", publishedAt: new Date(), publishedByName: "Sam" }).where(eq(planogramAdjustments.id, id));
/** Runs `change` once, just before the next batch of this size (the write under test). */
const beforeBatchOfSize = (wanted: number, change: () => Promise<unknown>) => {
  hooks.beforeBatch = async (size) => {
    if (size !== wanted) return;
    hooks.beforeBatch = null;
    await change();
  };
};

describe("openAdjustment", () => {
  it("has nothing to adjust until a version is published", async () => {
    const s = await publishedPlanogram("adjw-open-none");
    await db.update(planograms).set({ publishedVersion: null }).where(eq(planograms.storeId, s.store));
    expect(await openAdjustment(s.store, s.f.fixtureId, "Sam")).toEqual({ status: "not-found" });
  });

  it("starts a draft pinned to the published version, and opening again continues it", async () => {
    const s = await publishedPlanogram("adjw-open");
    const first = await openDraft(s);
    expect(first).toMatchObject({ state: "draft", basedOnVersion: 1, createdByName: "Sam", changes: [] });
    expect(await openAdjustment(s.store, s.f.fixtureId, "Pat")).toMatchObject({ status: "saved", draft: { id: first.id, createdByName: "Sam" } });
    expect(await db.select().from(planogramAdjustments).where(eq(planogramAdjustments.storeId, s.store))).toHaveLength(1);
  });

  it("a new draft copies the published adjustment's changes", async () => {
    const s = await publishedPlanogram("adjw-copy");
    const draft = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "replace", productId: s.slim }, null);
    await publish(draft.id);
    const next = await openDraft(s);
    expect(next.id).not.toBe(draft.id);
    expect(next.changes).toMatchObject([{ kind: "replace", replacement: { productId: s.slim, productName: "Slim Jean" } }]);
  });

  it("a second device that opens at the same moment adopts the first's draft", async () => {
    const s = await publishedPlanogram("adjw-open-race");
    let winner = "";
    // The open batch is the only three-statement one (pin, insert, copy).
    beforeBatchOfSize(3, async () => {
      const row = await planogramOf(s.store, s.f.fixtureId);
      const [made] = await db.insert(planogramAdjustments).values({ storeId: s.store, planogramId: row?.id ?? "", basedOnVersion: 1, createdByName: "Pat" }).returning({ id: planogramAdjustments.id });
      winner = made.id;
    });
    expect(await openAdjustment(s.store, s.f.fixtureId, "Sam")).toMatchObject({ status: "saved", draft: { id: winner, createdByName: "Pat" } });
  });

  it("is refused when a full publish moved the version meanwhile, and leaves no draft", async () => {
    const s = await publishedPlanogram("adjw-open-moved");
    beforeBatchOfSize(3, () => db.update(planograms).set({ publishedVersion: 2 }).where(eq(planograms.storeId, s.store)));
    expect(await openAdjustment(s.store, s.f.fixtureId, "Sam")).toEqual({ status: "conflict" });
    expect(await db.select().from(planogramAdjustments).where(eq(planogramAdjustments.storeId, s.store))).toEqual([]);
  });
});

describe("setChange", () => {
  it("writes a replace from the snapshot: the tile's cells and pieces, the product's own footprint", async () => {
    const s = await publishedPlanogram("adjw-replace");
    const draft = await openDraft(s);
    expect(await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "replace", productId: s.slim }, null)).toEqual({ status: "saved" });
    const row = await planogramOf(s.store, s.f.fixtureId);
    expect((await loadAdjustments(s.store, row?.id ?? "")).draft?.changes).toMatchObject([
      {
        kind: "replace",
        version: 1,
        pieceCount: 1,
        target: { faceId: s.f.faceId, productId: s.f.productId, presentation: "folded", col: 0, row: 0, depth: 0 },
        replacement: { productId: s.slim, productName: "Slim Jean" },
      },
    ]);
  });

  it("changes a replace to an empty with the row's version, and Keep clears it", async () => {
    const s = await publishedPlanogram("adjw-kinds");
    const draft = await openDraft(s);
    const at = (expected: number | null, choice: Parameters<typeof setChange>[4]) => setChange(s.store, s.f.fixtureId, draft.id, s.target, choice, expected);
    expect(await at(null, { kind: "replace", productId: s.slim })).toEqual({ status: "saved" });
    expect(await at(1, { kind: "empty" })).toEqual({ status: "saved" });
    expect(await changesOf(draft.id)).toMatchObject([{ kind: "empty", version: 2, replacementProductId: null }]);
    expect(await at(2, { kind: "keep" })).toEqual({ status: "saved" });
    expect(await changesOf(draft.id)).toEqual([]);
    expect(await at(null, { kind: "keep" })).toEqual({ status: "saved" }); // nothing to clear
  });

  it("a second insert for the tile, or a version that is not the row's, is a conflict", async () => {
    const s = await publishedPlanogram("adjw-conflict");
    const draft = await openDraft(s);
    const at = (expected: number | null) => setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "empty" }, expected);
    expect(await at(null)).toEqual({ status: "saved" });
    expect(await at(null)).toEqual({ status: "conflict" });
    expect(await at(5)).toEqual({ status: "conflict" });
  });

  it("another device's change to the tile between the load and the batch is a conflict, not a lost update", async () => {
    const s = await publishedPlanogram("adjw-between");
    const draft = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "empty" }, null);
    // The change batch is the only three-statement one here (pin the version, guard the adjustment, write the change).
    beforeBatchOfSize(3, () => db.update(planogramAdjustmentChanges).set({ version: 2 }).where(eq(planogramAdjustmentChanges.adjustmentId, draft.id)));
    expect(await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "replace", productId: s.slim }, 1)).toEqual({ status: "conflict" });
    expect(await changesOf(draft.id)).toMatchObject([{ kind: "empty" }]);
  });

  it("two tiles never conflict: only the tile's own version is guarded", async () => {
    const s = await publishedPlanogram("adjw-two-tiles", true);
    const draft = await openDraft(s);
    const set = (target: typeof s.target, expected: number | null) => setChange(s.store, s.f.fixtureId, draft.id, target, { kind: "empty" }, expected);
    expect(await set(s.target, null)).toEqual({ status: "saved" });
    expect(await set(s.teeTarget, null)).toEqual({ status: "saved" });
    expect(await set(s.target, 1)).toEqual({ status: "saved" }); // the other tile's save did not move this one's version
    expect(await changesOf(draft.id)).toHaveLength(2);
  });

  it("is refused when the draft is gone, published between the read and the write, or never existed", async () => {
    const s = await publishedPlanogram("adjw-state");
    const draft = await openDraft(s);
    const set = (id: string) => setChange(s.store, s.f.fixtureId, id, s.target, { kind: "empty" }, null);
    expect(await set("00000000-0000-4000-8000-000000000000")).toEqual({ status: "conflict" });
    beforeBatchOfSize(3, () => publish(draft.id));
    expect(await set(draft.id)).toEqual({ status: "conflict" });
    expect(await changesOf(draft.id)).toEqual([]);
  });

  it("is refused when the adjustment's version is no longer the published one, whether the version moved before the read or before the batch", async () => {
    const s = await publishedPlanogram("adjw-pin");
    const draft = await openDraft(s);
    beforeBatchOfSize(3, () => db.update(planograms).set({ publishedVersion: 2 }).where(eq(planograms.storeId, s.store)));
    expect(await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "empty" }, null)).toEqual({ status: "conflict" });
    await db.update(planogramAdjustments).set({ basedOnVersion: 3 }).where(eq(planogramAdjustments.id, draft.id));
    await db.update(planograms).set({ publishedVersion: 1 }).where(eq(planograms.storeId, s.store));
    expect(await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "empty" }, null)).toEqual({ status: "conflict" });
    expect(await changesOf(draft.id)).toEqual([]);
  });

  it("refuses a sold out replacement, one from another store, one that does not fit and a tile not in the version", async () => {
    const s = await publishedPlanogram("adjw-refuse");
    const draft = await openDraft(s);
    const set = (target: typeof s.target, productId: string) => setChange(s.store, s.f.fixtureId, draft.id, target, { kind: "replace", productId }, null);
    await db.update(products).set({ status: "sold_out" }).where(eq(products.id, s.slim));
    expect(await set(s.target, s.slim)).toMatchObject({ status: "invalid", message: expect.stringContaining("sold out") });
    await db.update(products).set({ status: "in_stock" }).where(eq(products.id, s.slim));
    expect(await set({ ...s.target, col: 3 }, s.slim)).toMatchObject({ status: "invalid" });
    const other = await publishedPlanogram("adjw-refuse-other");
    expect(await set(s.target, other.slim)).toMatchObject({ status: "invalid" });
    // A footprint of 20 columns runs off a 6-column face.
    await db.insert(productFootprints).values({ storeId: s.store, productId: s.slim, presentation: "folded", columns: 20, rows: 2 });
    expect(await set(s.target, s.slim)).toMatchObject({ status: "invalid", message: expect.stringContaining("edge") });
    expect(await changesOf(draft.id)).toEqual([]);
  });

  it("never bumps the planogram's version, so a monthly draft keeps saving", async () => {
    const s = await publishedPlanogram("adjw-version");
    const before = await planogramOf(s.store, s.f.fixtureId);
    const draft = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "empty" }, null);
    expect((await planogramOf(s.store, s.f.fixtureId))?.version).toBe(before?.version);
  });
});
