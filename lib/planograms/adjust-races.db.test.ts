// The races between Quick Adjust writes and a full publish (0.7.0.9 spec §6.3), decided in SQL and made
// deterministic the way publish.test.ts does it: a write's batch is built from a read, then another save
// lands, then the batch runs (a hook before the batch, or statements built from a stale read).

import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { planogramAdjustments, planogramVersions, productFootprints, productLocations, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { dropStores } from "@/lib/products/test-stores";

import { applyAdjustment } from "./adjust";
import { publishAdjustment, publishAdjustmentStatements, revertAdjustment } from "./adjust-publish";
import { loadAdjustments } from "./adjust-queries";
import { setChange } from "./adjust-write";
import { publishDraft, publishStatements } from "./publish";
import { loadPlanogram } from "./queries";
import { openDraft, publishedPlanogram, VAN, type Published } from "./test-adjust-flow";
import { changeStatements, saveChange, startDraft } from "./write";
import { scopeFor } from "./write-core";

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
const beforeBatchOfSize = (wanted: number, change: () => Promise<unknown>) => {
  hooks.beforeBatch = async (size) => {
    if (size !== wanted) return;
    hooks.beforeBatch = null;
    await change();
  };
};
// The publish batches by size: a full publish and an adjustment publish are five statements, a revert four.
const FULL_OR_ADJUST_PUBLISH = 5;
const REVERT = 4;

const pantTile = (s: Published) => ({ ...s.target });
const adjustmentsOf = (store: string) => db.select().from(planogramAdjustments).where(eq(planogramAdjustments.storeId, store)).orderBy(asc(planogramAdjustments.createdAt));
const floorNames = async (store: string) =>
  (await db.select({ name: products.name }).from(productLocations).innerJoin(products, eq(products.id, productLocations.productId)).where(eq(productLocations.storeId, store))).map((r) => r.name);
const row = async (s: Published) => (await loadPlanogram(s.store, s.f.fixtureId)).row;

async function withDraft(label: string) {
  const s = await publishedPlanogram(label);
  await db.insert(productFootprints).values({ storeId: s.store, productId: s.slim, presentation: "folded", columns: 3, rows: 2 });
  const opened = await openDraft(s);
  await setChange(s.store, s.f.fixtureId, opened.id, pantTile(s), { kind: "replace", productId: s.slim }, null);
  const draft = (await loadAdjustments(s.store, (await row(s))?.id ?? "")).draft;
  if (!draft) throw new Error("setup");
  return { s, draft };
}

/** A full publish of a monthly draft (the pant moved to column 2), as another device would do. */
async function fullPublish(s: Published) {
  await startDraft(s.store, s.f.fixtureId, (await row(s))?.version ?? 0);
  const monthly = (await loadPlanogram(s.store, s.f.fixtureId)).draft;
  const pant = monthly?.placements[0];
  if (!pant) throw new Error("setup");
  await saveChange(s.store, s.f.fixtureId, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, col: 2 } });
  const now = (await loadPlanogram(s.store, s.f.fixtureId)).draft;
  return publishDraft(s.store, s.f.fixtureId, now?.planogramVersion ?? 0, 1, null, VAN);
}

describe("an adjustment publish against a full publish", () => {
  it("a full publish landing first refuses the adjustment publish, which changes nothing", async () => {
    const { s, draft } = await withDraft("adjr-pub-full");
    beforeBatchOfSize(FULL_OR_ADJUST_PUBLISH, async () => expect(await fullPublish(s)).toEqual({ status: "saved", number: 2 }));
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN)).toEqual({ status: "published-elsewhere", number: 2 });
    expect((await adjustmentsOf(s.store)).map((a) => [a.state, a.endedReason])).toEqual([["ended", "new_version"]]);
    expect(await floorNames(s.store)).toEqual(["High-Rise Pant"]); // the full publish's floor, not the adjusted one
  });

  it("statements built before the full publish are refused by the published_version guard", async () => {
    const { s, draft } = await withDraft("adjr-stale-pin");
    const scope = await scopeFor(s.store, s.f.fixtureId);
    const { row: stale, latest } = await loadPlanogram(s.store, s.f.fixtureId);
    if (!scope || !stale || !latest) throw new Error("setup");
    const floor = applyAdjustment(latest.placements, draft.changes).entries;
    await fullPublish(s);
    await expect(withStore(s.store, publishAdjustmentStatements(s.store, scope, stale, draft, floor, VAN))).rejects.toThrow(/layout_conflict:planogram/);
    expect(await floorNames(s.store)).toEqual(["High-Rise Pant"]);
    expect((await adjustmentsOf(s.store)).every((a) => a.state === "ended")).toBe(true);
  });
});

describe("two adjustment publishes", () => {
  it("the second, built from the same read, is refused by the adjustment's version and the first stays", async () => {
    const { s, draft } = await withDraft("adjr-pub-pub");
    const scope = await scopeFor(s.store, s.f.fixtureId);
    const { row: stale, latest } = await loadPlanogram(s.store, s.f.fixtureId);
    if (!scope || !stale || !latest) throw new Error("setup");
    const floor = applyAdjustment(latest.placements, draft.changes).entries;
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN)).toEqual({ status: "saved" });
    await expect(withStore(s.store, publishAdjustmentStatements(s.store, scope, stale, draft, floor, { id: null, name: "Pat" }))).rejects.toThrow(/layout_conflict:adjustment/);
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "published", publishedByName: "Van" }]); // not superseded by the loser
    expect(await floorNames(s.store)).toEqual(["Slim Jean"]);
  });

  it("a change saved after the publish read the draft refuses it (the draft's version moved)", async () => {
    const { s, draft } = await withDraft("adjr-pub-save");
    beforeBatchOfSize(FULL_OR_ADJUST_PUBLISH, async () => {
      expect(await setChange(s.store, s.f.fixtureId, draft.id, pantTile(s), { kind: "empty" }, 1)).toEqual({ status: "saved" });
    });
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN)).toEqual({ status: "draft-changed" });
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "draft" }]);
    expect(await floorNames(s.store)).toEqual(["High-Rise Pant"]);
  });
});

describe("a revert", () => {
  it("against a draft's publish: the publish supersedes the adjustment, so the revert is refused", async () => {
    const { s, draft } = await withDraft("adjr-rev-pub");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    const next = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, next.id, pantTile(s), { kind: "empty" }, next.changes[0].version);
    const current = (await loadAdjustments(s.store, (await row(s))?.id ?? "")).draft;
    beforeBatchOfSize(REVERT, async () => expect(await publishAdjustment(s.store, s.f.fixtureId, next.id, current?.version ?? 0, VAN)).toEqual({ status: "saved" }));
    expect(await revertAdjustment(s.store, s.f.fixtureId, draft.id)).toEqual({ status: "conflict" });
    expect((await adjustmentsOf(s.store)).map((a) => [a.state, a.endedReason])).toEqual([["ended", "superseded"], ["published", null]]);
    expect(await floorNames(s.store)).toEqual([]); // the new adjustment's floor (the tile left empty)
  });

  it("against a full publish: the publish ends the adjustment, so the revert is refused and the full floor stands", async () => {
    const { s, draft } = await withDraft("adjr-rev-full");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    beforeBatchOfSize(REVERT, async () => expect(await fullPublish(s)).toEqual({ status: "saved", number: 2 }));
    expect(await revertAdjustment(s.store, s.f.fixtureId, draft.id)).toEqual({ status: "conflict" });
    expect(await floorNames(s.store)).toEqual(["High-Rise Pant"]);
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "ended", endedReason: "new_version" }]);
    expect(await db.select().from(planogramVersions).where(eq(planogramVersions.storeId, s.store))).toHaveLength(2);
  });
});

describe("the planogram's version", () => {
  it("a monthly draft save built before an adjustment publish still lands: no false conflict", async () => {
    const { s, draft } = await withDraft("adjr-monthly");
    await startDraft(s.store, s.f.fixtureId, (await row(s))?.version ?? 0);
    const { row: stale, draft: monthly } = await loadPlanogram(s.store, s.f.fixtureId);
    const pant = monthly?.placements[0];
    if (!stale || !pant) throw new Error("setup");
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN)).toEqual({ status: "saved" });
    // Built from the planogram version it read before the adjustment published: a bump would make its guard fail.
    const save = changeStatements(s.store, stale, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, col: 4 } }, pant.productId);
    await withStore(s.store, save);
    expect((await loadPlanogram(s.store, s.f.fixtureId)).draft?.placements[0]).toMatchObject({ col: 4 });
  });
});

describe("a refused full publish", () => {
  it("leaves the open adjustments as they were (the end is in the guarded batch)", async () => {
    const { s, draft } = await withDraft("adjr-full-refused");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    await startDraft(s.store, s.f.fixtureId, (await row(s))?.version ?? 0);
    const scope = await scopeFor(s.store, s.f.fixtureId);
    const { row: stale, draft: monthly } = await loadPlanogram(s.store, s.f.fixtureId);
    if (!scope || !stale || !monthly) throw new Error("setup");
    const pant = monthly.placements[0];
    await saveChange(s.store, s.f.fixtureId, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, col: 3 } });
    await expect(withStore(s.store, publishStatements(s.store, scope, stale, monthly, null, VAN))).rejects.toThrow(/layout_conflict:planogram/);
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "published", endedReason: null }]);
  });
});
