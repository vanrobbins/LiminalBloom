// Publishing against the dev database: the version, the floor rewrite limited
// to this planogram, the publish guards, and restore.

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { fixtureFaces, planogramVersions, productLocations, products } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { publishDraft, publishStatements, previewPublish, restoreVersion } from "./publish";
import { draftState, loadPlanogram } from "./queries";
import { addFixture, addProduct, addTableSet } from "./test-planograms";
import { saveChange, scopeFor, startDraft } from "./write";

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

const VAN = { id: null, name: "Van" };

async function setUp(label: string) {
  const store = await makeStore(label);
  const f = await seedStoreFixtures(store);
  const tee = await addProduct(store, f.categoryId, "Pocket Tee");
  await startDraft(store, f.fixtureId, null);
  return { store, f, tee };
}

const floorOf = async (store: string, faceId: string) =>
  db.select().from(productLocations).where(and(eq(productLocations.storeId, store), eq(productLocations.faceId, faceId)));

async function movePant(store: string, fixtureId: string, col: number) {
  const pant = (await draftState(store, fixtureId))?.placements[0];
  if (!pant) throw new Error("setup");
  await saveChange(store, fixtureId, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, col } });
}

describe("publishDraft", () => {
  it("writes version 1 and rewrites only this fixture's floor", async () => {
    const { store, f } = await setUp("pg-publish");
    const rack = await addFixture(store);
    const rackFace = rack.faceIds.front ?? "";
    await db.insert(productLocations).values({ storeId: store, productId: f.productId, presentation: "hung", faceId: rackFace, col: 0, row: 0, colSpan: 1, rowSpan: 3 });
    await movePant(store, f.fixtureId, 2);

    const preview = await previewPublish(store, f.fixtureId);
    expect(preview).toMatchObject({ nextNumber: 1, isEmpty: false, issues: [] });
    const result = await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, "October denim reset", VAN);
    expect(result).toEqual({ status: "saved", number: 1 });

    expect((await floorOf(store, f.faceId)).map((l) => [l.col, l.row, l.colSpan, l.rowSpan])).toEqual([[2, 0, 2, 2]]);
    expect(await floorOf(store, rackFace)).toHaveLength(1); // another fixture: untouched
    expect(await db.select().from(productLocations).where(eq(productLocations.binId, f.binId))).toHaveLength(0); // seed has no bin location; never added
    const [version] = await db.select().from(planogramVersions).where(eq(planogramVersions.storeId, store));
    expect(version).toMatchObject({ number: 1, summary: "October denim reset", publishedByName: "Van" });
    expect(version.placements).toEqual([expect.objectContaining({ productName: "High-Rise Pant", fixtureName: "Front table 1", faceLabel: "Top", col: 2, pieceCount: 1 })]);
    const state = await loadPlanogram(store, f.fixtureId);
    expect(state.row).toMatchObject({ publishedVersion: 1, hasDraft: false, basedOnVersion: null });
  });

  it("leaves bin locations alone", async () => {
    const { store, f } = await setUp("pg-publish-bin");
    await db.insert(productLocations).values({ storeId: store, productId: f.productId, presentation: "folded", binId: f.binId });
    const preview = await previewPublish(store, f.fixtureId);
    await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN);
    expect(await db.select().from(productLocations).where(eq(productLocations.binId, f.binId))).toHaveLength(1);
  });

  it("is refused when the draft changed after the preview, and changes nothing", async () => {
    const { store, f, tee } = await setUp("pg-publish-stale");
    const preview = await previewPublish(store, f.fixtureId);
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: { faceId: f.faceId, presentation: "folded", col: 3, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 1 } });
    expect(await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN)).toEqual({ status: "draft-changed" });
    expect(await db.select().from(planogramVersions).where(eq(planogramVersions.storeId, store))).toEqual([]);
  });

  it("publish statements built before another save are refused and change nothing", async () => {
    const { store, f, tee } = await setUp("pg-publish-race");
    const scope = await scopeFor(store, f.fixtureId);
    const { row, draft } = await loadPlanogram(store, f.fixtureId);
    if (!scope || !row || !draft) throw new Error("setup");
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: { faceId: f.faceId, presentation: "folded", col: 3, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 1 } });
    await expect(withStore(store, publishStatements(store, scope, row, draft, null, VAN))).rejects.toThrow(/layout_conflict:planogram/);
    expect(await db.select().from(planogramVersions).where(eq(planogramVersions.storeId, store))).toEqual([]);
    expect((await floorOf(store, f.faceId)).map((l) => l.col)).toEqual([0]);
    expect((await draftState(store, f.fixtureId))?.placements).toHaveLength(2);
  });

  it("a product deleted between the load and the batch is a changed draft, not a failure", async () => {
    const { store, f, tee } = await setUp("pg-publish-fk");
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: { faceId: f.faceId, presentation: "folded", col: 3, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 1 } });
    const preview = await previewPublish(store, f.fixtureId);
    // The publish batch is the only five-statement one (guard, version, clear floor, floor, drop draft).
    hooks.beforeBatch = async (size) => {
      if (size !== 5) return;
      hooks.beforeBatch = null;
      await db.delete(products).where(eq(products.id, tee));
    };
    expect(await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN)).toEqual({ status: "draft-changed" });
    expect(await db.select().from(planogramVersions).where(eq(planogramVersions.storeId, store))).toEqual([]);
  });

  it("says so when someone else published first", async () => {
    const { store, f } = await setUp("pg-publish-elsewhere");
    const mine = await previewPublish(store, f.fixtureId);
    const theirs = await previewPublish(store, f.fixtureId);
    await publishDraft(store, f.fixtureId, theirs?.planogramVersion ?? 0, null, null, VAN);
    expect(await publishDraft(store, f.fixtureId, mine?.planogramVersion ?? 0, mine?.basedOnVersion ?? null, null, VAN)).toEqual({
      status: "published-elsewhere",
      number: 1,
    });
  });

  it("refuses to publish a placement off the edge", async () => {
    const { store, f } = await setUp("pg-publish-edge");
    await db.update(fixtureFaces).set({ columns: 1 }).where(eq(fixtureFaces.id, f.faceId));
    const preview = await previewPublish(store, f.fixtureId);
    expect(preview?.issues).toEqual([expect.objectContaining({ productName: "High-Rise Pant", message: "Off the edge of the face" })]);
    expect(await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN)).toEqual({
      status: "invalid",
      message: "Fix the marked placements before publishing.",
    });
  });

  it("an empty draft clears the fixture", async () => {
    const { store, f } = await setUp("pg-publish-empty");
    const pant = (await draftState(store, f.fixtureId))?.placements[0];
    if (!pant) throw new Error("setup");
    await saveChange(store, f.fixtureId, { kind: "remove", id: pant.id, version: pant.version });
    const preview = await previewPublish(store, f.fixtureId);
    expect(preview?.isEmpty).toBe(true);
    await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN);
    expect(await floorOf(store, f.faceId)).toEqual([]);
  });

  it("publishes a table set onto the lower tables too, and numbers versions in order", async () => {
    const store = await makeStore("pg-publish-set");
    const f = await seedStoreFixtures(store);
    const set = await addTableSet(store);
    await startDraft(store, set.upperId, null);
    const add = (faceId: string) =>
      saveChange(store, set.upperId, { kind: "add", productId: f.productId, fields: { faceId, presentation: "folded", col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 2 } });
    expect(await add(set.upperFaceId)).toEqual({ status: "saved" });
    expect(await add(set.frontFaceId)).toEqual({ status: "saved" });
    const first = await previewPublish(store, set.upperId);
    expect(first?.changes.map((c) => c.label)).toEqual(["Upper", "Front table"]);
    await publishDraft(store, set.upperId, first?.planogramVersion ?? 0, null, null, VAN);
    expect(await floorOf(store, set.frontFaceId)).toHaveLength(1);

    await startDraft(store, set.upperId, (await loadPlanogram(store, set.upperId)).row?.version ?? 0);
    const second = await previewPublish(store, set.upperId);
    expect(await publishDraft(store, set.upperId, second?.planogramVersion ?? 0, 1, null, VAN)).toEqual({ status: "saved", number: 2 });
  });
});

describe("restoreVersion", () => {
  it("loads a version as a draft, skipping deleted products", async () => {
    const { store, f, tee } = await setUp("pg-restore");
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: { faceId: f.faceId, presentation: "folded", col: 3, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 5 } });
    const preview = await previewPublish(store, f.fixtureId);
    await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN);
    await db.delete(products).where(eq(products.id, tee));

    const { row } = await loadPlanogram(store, f.fixtureId);
    expect(await restoreVersion(store, f.fixtureId, (row?.version ?? 0) + 1, 1)).toEqual({ status: "conflict" });
    expect(await restoreVersion(store, f.fixtureId, row?.version ?? 0, 1)).toEqual({ status: "saved", skipped: { product: 1, face: 0, fit: 0 } });
    const state = await loadPlanogram(store, f.fixtureId);
    expect(state.row).toMatchObject({ hasDraft: true, basedOnVersion: 1 });
    expect(state.draft?.placements.map((p) => p.productName)).toEqual(["High-Rise Pant"]);
    // The version itself still names the deleted product.
    expect(state.latest?.placements.map((p) => p.productName)).toEqual(["High-Rise Pant", "Pocket Tee"]);
  });
});
