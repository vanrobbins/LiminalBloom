// Publishing, reverting and previewing a Quick Adjust against the dev database (0.7.0.9 spec §6.3, §6.4).
// The races between them and a full publish are in adjust-races.db.test.ts.

import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { planogramAdjustments, planogramVersions, productFootprints, productLocations, products } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { previewAdjustment } from "./adjust-reads";
import { adjustedFloor } from "./adjust";
import { loadAdjustments } from "./adjust-queries";
import { publishAdjustment, revertAdjustment } from "./adjust-publish";
import { setChange } from "./adjust-write";
import { previewPublish, publishDraft } from "./publish";
import { loadPlanogram } from "./queries";
import { openDraft, publishedPlanogram, VAN, type Published } from "./test-adjust-flow";
import { addFixture } from "./test-planograms";
import { saveChange, startDraft } from "./write";

afterAll(dropStores);

const adjustmentsOf = (store: string) => db.select().from(planogramAdjustments).where(eq(planogramAdjustments.storeId, store)).orderBy(asc(planogramAdjustments.createdAt));
const floorOf = async (store: string) =>
  (await db.select({ name: products.name, p: productLocations.presentation, col: productLocations.col, row: productLocations.row, cs: productLocations.colSpan, rs: productLocations.rowSpan, depth: productLocations.depth })
    .from(productLocations).innerJoin(products, eq(products.id, productLocations.productId)).where(eq(productLocations.storeId, store))
    .orderBy(asc(productLocations.col), asc(productLocations.row)));
const planogramOf = async (s: Published) => (await loadPlanogram(s.store, s.f.fixtureId)).row;

/** A draft adjustment that replaces the pant with the slim jean (3x2 folded, set by an override). */
async function replaced(label: string) {
  const s = await publishedPlanogram(label);
  await db.insert(productFootprints).values({ storeId: s.store, productId: s.slim, presentation: "folded", columns: 3, rows: 2 });
  const draft = await openDraft(s);
  expect(await setChange(s.store, s.f.fixtureId, draft.id, s.target, { kind: "replace", productId: s.slim }, null)).toEqual({ status: "saved" });
  const current = (await loadAdjustments(s.store, (await planogramOf(s))?.id ?? "")).draft;
  return { s, draft: current ?? draft };
}

describe("publishAdjustment", () => {
  it("rewrites the floor from the adjusted version, ends nothing else and leaves the planogram's version alone", async () => {
    const { s, draft } = await replaced("adjp-publish");
    const rackFace = (await addFixture(s.store)).faceIds.front ?? "";
    await db.insert(productLocations).values({ storeId: s.store, productId: s.f.productId, presentation: "hung", faceId: rackFace, col: 0, row: 0, colSpan: 1, rowSpan: 3 });
    await db.insert(productLocations).values({ storeId: s.store, productId: s.f.productId, presentation: "folded", binId: s.f.binId });
    const before = await planogramOf(s);

    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN)).toEqual({ status: "saved" });

    const onFace = (faceId: string) => db.select().from(productLocations).where(eq(productLocations.faceId, faceId));
    expect(await onFace(s.f.faceId)).toMatchObject([{ productId: s.slim, col: 0, row: 0, colSpan: 3, rowSpan: 2 }]);
    expect(await onFace(rackFace)).toHaveLength(1); // another fixture: untouched
    expect(await db.select().from(productLocations).where(eq(productLocations.binId, s.f.binId))).toHaveLength(1); // a bin: untouched
    expect(await planogramOf(s)).toEqual(before); // no version bump, same published version
    expect(await db.select().from(planogramVersions).where(eq(planogramVersions.storeId, s.store))).toHaveLength(1);
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "published", publishedByName: "Van", basedOnVersion: 1 }]);
  });

  it("is refused for a draft with nothing in it", async () => {
    const s = await publishedPlanogram("adjp-empty");
    const draft = await openDraft(s);
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN)).toMatchObject({ status: "invalid" });
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "draft" }]);
  });

  it("is refused when the draft changed since it was read, or is not this planogram's draft", async () => {
    const { s, draft } = await replaced("adjp-stale");
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version - 1, VAN)).toEqual({ status: "draft-changed" });
    expect(await publishAdjustment(s.store, s.f.fixtureId, "00000000-0000-4000-8000-000000000000", 1, VAN)).toEqual({ status: "draft-changed" });
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "draft" }]);
  });

  it("a draft that copied the published one replaces it in the same batch", async () => {
    const { s, draft } = await replaced("adjp-supersede");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    const next = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, next.id, s.target, { kind: "empty" }, next.changes[0].version);
    const current = (await loadAdjustments(s.store, (await planogramOf(s))?.id ?? "")).draft;
    expect(await publishAdjustment(s.store, s.f.fixtureId, next.id, current?.version ?? 0, VAN)).toEqual({ status: "saved" });
    expect((await adjustmentsOf(s.store)).map((a) => [a.state, a.endedReason])).toEqual([["ended", "superseded"], ["published", null]]);
    expect((await floorOf(s.store)).map((l) => l.name)).toEqual([]); // the pant's tile left empty
  });

  it("puts the same floor rows in product_locations as a full publish of the same layout", async () => {
    const { s, draft } = await replaced("adjp-same-a");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);

    const b = await publishedPlanogram("adjp-same-b");
    await db.insert(productFootprints).values({ storeId: b.store, productId: b.slim, presentation: "folded", columns: 3, rows: 2 });
    await startDraft(b.store, b.f.fixtureId, (await planogramOf(b))?.version ?? 0);
    const monthly = (await loadPlanogram(b.store, b.f.fixtureId)).draft;
    const pant = monthly?.placements[0];
    if (!pant || !monthly) throw new Error("setup");
    await saveChange(b.store, b.f.fixtureId, { kind: "remove", id: pant.id, version: pant.version });
    await saveChange(b.store, b.f.fixtureId, { kind: "add", productId: b.slim, fields: { faceId: b.f.faceId, presentation: "folded", col: 0, row: 0, colSpan: 3, rowSpan: 2, pieceCount: 1, depth: 0 } });
    const now = (await loadPlanogram(b.store, b.f.fixtureId)).draft;
    await publishDraft(b.store, b.f.fixtureId, now?.planogramVersion ?? 0, 1, null, VAN);

    expect(await floorOf(b.store)).toEqual(await floorOf(s.store));
    expect(await floorOf(s.store)).toEqual([{ name: "Slim Jean", p: "folded", col: 0, row: 0, cs: 3, rs: 2, depth: 0 }]);
  });
});

describe("revertAdjustment", () => {
  it("ends it and puts the version's own floor back", async () => {
    const { s, draft } = await replaced("adjp-revert");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    expect(await revertAdjustment(s.store, s.f.fixtureId, draft.id)).toEqual({ status: "saved" });
    expect((await floorOf(s.store)).map((l) => [l.name, l.cs, l.rs])).toEqual([["High-Rise Pant", 2, 2]]);
    expect(await adjustmentsOf(s.store)).toMatchObject([{ state: "ended", endedReason: "reverted" }]);
    expect((await planogramOf(s))?.publishedVersion).toBe(1);
  });

  it("is a conflict for a draft, an ended adjustment or one that is not there", async () => {
    const { s, draft } = await replaced("adjp-revert-no");
    expect(await revertAdjustment(s.store, s.f.fixtureId, draft.id)).toEqual({ status: "conflict" });
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    await revertAdjustment(s.store, s.f.fixtureId, draft.id);
    expect(await revertAdjustment(s.store, s.f.fixtureId, draft.id)).toEqual({ status: "conflict" });
    expect(await revertAdjustment(s.store, s.f.fixtureId, "00000000-0000-4000-8000-000000000000")).toEqual({ status: "conflict" });
  });

  it("skips a product deleted since the version, instead of failing on it", async () => {
    const { s, draft } = await replaced("adjp-revert-deleted");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    await db.delete(products).where(eq(products.id, s.f.productId));
    expect(await revertAdjustment(s.store, s.f.fixtureId, draft.id)).toEqual({ status: "saved" });
    expect(await floorOf(s.store)).toEqual([]);
  });
});

describe("a full publish and the preview", () => {
  it("lists the open adjustments, and the publish ends both the draft and the published one", async () => {
    const { s, draft } = await replaced("adjp-full");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    const next = await openDraft(s); // a draft copy of the published one
    await startDraft(s.store, s.f.fixtureId, (await planogramOf(s))?.version ?? 0);

    const preview = await previewPublish(s.store, s.f.fixtureId);
    expect(preview?.adjustments).toEqual([
      { adjustmentId: draft.id, state: "published", changes: [{ kind: "replace", faceLabel: "Top", from: "High-Rise Pant", to: "Slim Jean", fixtureName: "Front table 1" }] },
      { adjustmentId: next.id, state: "draft", changes: [{ kind: "replace", faceLabel: "Top", from: "High-Rise Pant", to: "Slim Jean", fixtureName: "Front table 1" }] },
    ]);

    expect(await publishDraft(s.store, s.f.fixtureId, preview?.planogramVersion ?? 0, 1, null, VAN)).toEqual({ status: "saved", number: 2 });
    expect((await adjustmentsOf(s.store)).map((a) => [a.state, a.endedReason])).toEqual([["ended", "new_version"], ["ended", "new_version"]]);
    expect((await floorOf(s.store)).map((l) => l.name)).toEqual(["High-Rise Pant"]); // the monthly layout, not the adjustment
  });

  it("with no adjustment the preview lists none", async () => {
    const s = await publishedPlanogram("adjp-full-none");
    await startDraft(s.store, s.f.fixtureId, (await planogramOf(s))?.version ?? 0);
    expect((await previewPublish(s.store, s.f.fixtureId))?.adjustments).toEqual([]);
  });
});

describe("previewAdjustment", () => {
  it("compares the version with its adjusted floor, in words and in two layouts", async () => {
    const { s, draft } = await replaced("adjp-preview");
    const preview = await previewAdjustment(s.store, s.f.fixtureId);
    expect(preview).toMatchObject({ kind: "draft", adjustmentId: draft.id, version: draft.version, basedOnVersion: 1 });
    expect(preview?.changes.map((c) => [c.label, c.added.map((p) => p.productName), c.removed.map((p) => p.productName)])).toEqual([["Top", ["Slim Jean"], ["High-Rise Pant"]]]);
    expect(preview?.before.map((e) => e.productName)).toEqual(["High-Rise Pant"]);
    expect(preview?.after.map((e) => e.productName)).toEqual(["Slim Jean"]);
    expect(Object.keys(preview?.looks ?? {}).sort()).toEqual([s.f.productId, s.slim].sort()); // what both grids draw with
    expect(preview?.soldOutAfter).toEqual([]);
    const latest = (await loadPlanogram(s.store, s.f.fixtureId)).latest;
    expect(adjustedFloor(latest, draft.changes).map((e) => e.productName)).toEqual(["Slim Jean"]);
  });

  it("names the products still sold out on the floor after the adjustment, for the publish warning", async () => {
    const { s } = await replaced("adjp-preview-sold");
    expect((await previewAdjustment(s.store, s.f.fixtureId))?.soldOutAfter).toEqual([]);
    await db.update(products).set({ status: "sold_out" }).where(eq(products.id, s.slim));
    expect((await previewAdjustment(s.store, s.f.fixtureId))?.soldOutAfter).toEqual(["Slim Jean"]);
  });

  it("reads the published adjustment when there is no draft, and nothing when there is neither", async () => {
    const { s, draft } = await replaced("adjp-preview-pub");
    await publishAdjustment(s.store, s.f.fixtureId, draft.id, draft.version, VAN);
    expect(await previewAdjustment(s.store, s.f.fixtureId)).toMatchObject({ kind: "published", adjustmentId: draft.id });
    await revertAdjustment(s.store, s.f.fixtureId, draft.id);
    expect(await previewAdjustment(s.store, s.f.fixtureId)).toBeNull();
  });
});
