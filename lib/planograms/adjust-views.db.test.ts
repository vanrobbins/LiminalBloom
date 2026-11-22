// The adjusted floor where it is read (0.7.0.9 spec §6.4) against the dev database: the planogram load, the map's
// floor, the list's one word, the product looks and the Quick Adjusts a publish would end.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { planogramAdjustments, products } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { adjustedOff, adjustedOffFor } from "./adjust-queries";
import { publishAdjustment } from "./adjust-publish";
import { setChange } from "./adjust-write";
import { floorPlanograms } from "./floor-view";
import { productLooks } from "./product-looks";
import { previewPublish } from "./publish";
import { loadPlanogram, planogramSummaries } from "./queries";
import { openDraft, publishedPlanogram, VAN, type Published } from "./test-adjust-flow";
import { startDraft } from "./write";

afterAll(dropStores);

const replaceTile = async (s: Published, kind: "replace" | "empty" = "replace") => {
  const draft = await openDraft(s);
  await setChange(s.store, s.f.fixtureId, draft.id, s.target, kind === "replace" ? { kind, productId: s.slim } : { kind }, null);
  return (await loadPlanogram(s.store, s.f.fixtureId, true)).adjustments.draft;
};
const names = async (s: Published) => (await floorPlanograms(s.store))[s.f.fixtureId].latest?.placements.map((p) => p.productName);

describe("loadPlanogram", () => {
  it("returns the draft and published adjustments with their changes when asked, and none by default", async () => {
    const s = await publishedPlanogram("adjv-load");
    const draft = await replaceTile(s);
    expect(draft?.changes).toMatchObject([{ kind: "replace", replacement: { productName: "Slim Jean" } }]);
    expect(await publishAdjustment(s.store, s.f.fixtureId, draft?.id ?? "", draft?.version ?? 0, VAN)).toEqual({ status: "saved" });
    const next = await openDraft(s);
    await setChange(s.store, s.f.fixtureId, next.id, s.target, { kind: "empty" }, next.changes[0].version);

    const both = (await loadPlanogram(s.store, s.f.fixtureId, true)).adjustments;
    expect(both.published).toMatchObject({ state: "published", publishedByName: "Van", changes: [{ kind: "replace" }] });
    expect(both.draft).toMatchObject({ state: "draft", changes: [{ kind: "empty" }] });
    expect((await loadPlanogram(s.store, s.f.fixtureId)).adjustments).toEqual({ draft: null, published: null });
  });

  it("an ended adjustment is not read", async () => {
    const s = await publishedPlanogram("adjv-ended");
    const draft = await replaceTile(s);
    await db.update(planogramAdjustments).set({ state: "ended", endedReason: "reverted", endedAt: new Date() }).where(eq(planogramAdjustments.id, draft?.id ?? ""));
    expect((await loadPlanogram(s.store, s.f.fixtureId, true)).adjustments).toEqual({ draft: null, published: null });
  });
});

describe("floorPlanograms", () => {
  it("draws the published adjustment's floor, not a draft's", async () => {
    const s = await publishedPlanogram("adjv-floor");
    const draft = await replaceTile(s);
    expect(await names(s)).toEqual(["High-Rise Pant"]);
    await publishAdjustment(s.store, s.f.fixtureId, draft?.id ?? "", draft?.version ?? 0, VAN);
    expect(await names(s)).toEqual(["Slim Jean"]);
    expect((await floorPlanograms(s.store))[s.f.fixtureId].latest?.number).toBe(1);
  });

  it("a tile left empty is gone from it, and a monthly draft in progress changes nothing", async () => {
    const s = await publishedPlanogram("adjv-floor-empty");
    const draft = await replaceTile(s, "empty");
    await publishAdjustment(s.store, s.f.fixtureId, draft?.id ?? "", draft?.version ?? 0, VAN);
    await startDraft(s.store, s.f.fixtureId, (await loadPlanogram(s.store, s.f.fixtureId)).row?.version ?? 0);
    expect(await names(s)).toEqual([]);
    expect((await floorPlanograms(s.store))[s.f.fixtureId]).toMatchObject({ hasDraft: true });
  });

  it("only this store's, and a planogram with no adjustment as it was published", async () => {
    const a = await publishedPlanogram("adjv-floor-a");
    const b = await publishedPlanogram("adjv-floor-b");
    const draft = await replaceTile(a);
    await publishAdjustment(a.store, a.f.fixtureId, draft?.id ?? "", draft?.version ?? 0, VAN);
    expect(await names(b)).toEqual(["High-Rise Pant"]);
    expect(Object.keys(await floorPlanograms(b.store))).toEqual([b.f.fixtureId]);
  });
});

describe("planogramSummaries", () => {
  it("says adjusting for a draft, adjusted for a published one, and the draft's word when both", async () => {
    const s = await publishedPlanogram("adjv-summary");
    const word = async () => (await planogramSummaries(s.store)).find((p) => p.fixtureId === s.f.fixtureId)?.adjustment;
    expect(await word()).toBeNull();
    const draft = await replaceTile(s);
    expect(await word()).toBe("draft");
    await publishAdjustment(s.store, s.f.fixtureId, draft?.id ?? "", draft?.version ?? 0, VAN);
    expect(await word()).toBe("published");
    await openDraft(s);
    expect(await word()).toBe("draft");
  });
});

describe("productLooks", () => {
  it("carries the product's status", async () => {
    const s = await publishedPlanogram("adjv-looks");
    await db.update(products).set({ status: "sold_out" }).where(eq(products.id, s.f.productId));
    const looks = await productLooks(s.store, [s.f.productId, s.slim]);
    expect([looks[s.f.productId].status, looks[s.slim].status]).toEqual(["sold_out", "in_stock"]);
  });
});

describe("adjustedOff", () => {
  it("names the fixtures a published adjustment took the product off, and none for a draft's", async () => {
    const s = await publishedPlanogram("adjv-off");
    const draft = await replaceTile(s);
    expect(await adjustedOff(s.store, s.f.productId)).toEqual([]);
    await publishAdjustment(s.store, s.f.fixtureId, draft?.id ?? "", draft?.version ?? 0, VAN);
    expect(await adjustedOff(s.store, s.f.productId)).toEqual([{ fixtureId: s.f.fixtureId, fixtureName: "Front table 1" }]);
    expect(await adjustedOff(s.store, s.slim)).toEqual([]);
    const many = await adjustedOffFor(s.store, [s.f.productId, s.slim]);
    expect([...many.keys()]).toEqual([s.f.productId]);
    expect((await adjustedOffFor(s.store, [])).size).toBe(0);
  });
});

describe("previewPublish", () => {
  it("warns of a product that is sold out and still in the draft", async () => {
    const s = await publishedPlanogram("adjv-soldout");
    await startDraft(s.store, s.f.fixtureId, (await loadPlanogram(s.store, s.f.fixtureId)).row?.version ?? 0);
    expect((await previewPublish(s.store, s.f.fixtureId))?.soldOut).toEqual([]);
    await db.update(products).set({ status: "sold_out" }).where(eq(products.id, s.f.productId));
    expect((await previewPublish(s.store, s.f.fixtureId))?.soldOut).toEqual(["High-Rise Pant"]);
  });
});
