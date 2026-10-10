// Draft writes against the dev database: starting, the per-row two-device
// rule, the server's placement checks, discard, due dates.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { fixtureFaces, planogramPlacements, planograms, productFootprints } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { draftState, loadPlanogram } from "./queries";
import { addFixture, addProduct, addTableSet } from "./test-planograms";
import { changeStatements, discardDraft, saveChange, setDueDate, startDraft } from "./write";

afterAll(dropStores);

/** A store whose "Front table 1" (top 6×3) has High-Rise Pant folded at A1–B2 on the floor. */
async function setUp(label: string) {
  const store = await makeStore(label);
  const f = await seedStoreFixtures(store);
  const tee = await addProduct(store, f.categoryId, "Pocket Tee");
  return { store, f, tee };
}

const fields = (faceId: string, over = {}) => ({ faceId, presentation: "folded" as const, col: 3, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 4, ...over });

describe("startDraft", () => {
  it("starts from the current floor when never published", async () => {
    const { store, f } = await setUp("pg-start");
    expect(await startDraft(store, f.fixtureId, null)).toEqual({ status: "saved" });
    const draft = await draftState(store, f.fixtureId);
    expect(draft?.planogramVersion).toBe(1);
    expect(draft?.placements).toEqual([
      expect.objectContaining({ productId: f.productId, faceId: f.faceId, col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 1, productName: "High-Rise Pant", stackLimit: 8 }),
    ]);
  });

  it("lets only one of two simultaneous starts through", async () => {
    const { store, f } = await setUp("pg-start-race");
    const results = await Promise.all([startDraft(store, f.fixtureId, null), startDraft(store, f.fixtureId, null)]);
    expect(results.map((r) => r.status).sort()).toEqual(["conflict", "saved"]);
    expect(await db.select().from(planograms).where(eq(planograms.fixtureId, f.fixtureId))).toHaveLength(1);
    expect((await draftState(store, f.fixtureId))?.placements).toHaveLength(1);
  });

  it("is refused when a draft already exists", async () => {
    const { store, f } = await setUp("pg-start-twice");
    await startDraft(store, f.fixtureId, null);
    expect(await startDraft(store, f.fixtureId, 1)).toEqual({ status: "conflict" });
  });

  it("a lower table cannot get its own planogram", async () => {
    const store = await makeStore("pg-lower");
    const set = await addTableSet(store);
    expect(await startDraft(store, set.frontId, null)).toEqual({ status: "not-found" });
    expect(await db.select().from(planograms).where(eq(planograms.fixtureId, set.frontId))).toEqual([]);
  });
});

describe("saveChange", () => {
  it("adds, then refuses overlap, the edge, a stack over the limit and another fixture's face", async () => {
    const { store, f, tee } = await setUp("pg-save");
    await startDraft(store, f.fixtureId, null);
    expect(await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: fields(f.faceId) })).toEqual({ status: "saved" });
    const add = (over: object) => saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: fields(f.faceId, over) });
    expect(await add({ col: 1 })).toEqual({ status: "invalid", message: "Blocked by High-Rise Pant" });
    expect(await add({ col: 5 })).toEqual({ status: "invalid", message: "Off the edge of the face" });
    expect(await add({ row: 2, rowSpan: 1, col: 0, pieceCount: 9 })).toEqual({ status: "invalid", message: "More than this product's stack limit (8)" });
    expect(await add({ row: 2, rowSpan: 1, col: 0, colSpan: 1, presentation: "hung", pieceCount: 20 })).toEqual({ status: "saved" });
    const rack = await addFixture(store);
    expect(await add({ faceId: rack.faceIds.front, col: 0 })).toEqual({ status: "invalid", message: "No longer in this set" });
    expect((await draftState(store, f.fixtureId))?.placements).toHaveLength(3);
  });

  it("a hung placement carries the product's folded stack limit, so hung → folded is checked against it", async () => {
    const { store, f, tee } = await setUp("pg-save-limit");
    await db.insert(productFootprints).values([
      { storeId: store, productId: tee, presentation: "folded", columns: 2, rows: 2, stackLimit: 5 },
      { storeId: store, productId: tee, presentation: "hung", columns: 1, rows: 3, stackLimit: 1 },
    ]);
    await startDraft(store, f.fixtureId, null);
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: fields(f.faceId, { col: 4, colSpan: 1, rowSpan: 3, presentation: "hung", pieceCount: 20 }) });
    const hung = (await draftState(store, f.fixtureId))?.placements.find((p) => p.productId === tee);
    expect(hung).toMatchObject({ presentation: "hung", stackLimit: 5 });
  });

  it("refuses a stale edit of one placement and lands edits to different ones", async () => {
    const { store, f, tee } = await setUp("pg-two-devices");
    await startDraft(store, f.fixtureId, null);
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: fields(f.faceId) });
    const before = await draftState(store, f.fixtureId);
    const pant = before?.placements.find((p) => p.productId === f.productId);
    const teeRow = before?.placements.find((p) => p.productId === tee);
    if (!pant || !teeRow) throw new Error("setup");

    // Device A moves the pant; device B, still holding version 1, changes its count.
    expect(await saveChange(store, f.fixtureId, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, row: 1 } })).toEqual({ status: "saved" });
    expect(await saveChange(store, f.fixtureId, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, pieceCount: 3 } })).toEqual({ status: "conflict" });
    // Device B's edit to the tee still lands.
    expect(await saveChange(store, f.fixtureId, { kind: "update", id: teeRow.id, version: teeRow.version, fields: { ...teeRow, pieceCount: 2 } })).toEqual({ status: "saved" });

    const after = await draftState(store, f.fixtureId);
    expect(after?.placements.find((p) => p.id === pant.id)).toMatchObject({ row: 1, pieceCount: 1, version: 2 });
    expect(after?.placements.find((p) => p.id === teeRow.id)).toMatchObject({ pieceCount: 2 });
  });

  it("a change built from a stale draft is refused and writes nothing", async () => {
    const { store, f, tee } = await setUp("pg-save-race");
    await startDraft(store, f.fixtureId, null);
    const { row } = await loadPlanogram(store, f.fixtureId);
    if (!row) throw new Error("setup");
    // Another device saves between this device's check and its batch.
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: fields(f.faceId) });
    const stale = changeStatements(store, row, { kind: "add", productId: tee, fields: fields(f.faceId) }, tee);
    await expect(withStore(store, stale)).rejects.toThrow(/layout_conflict:planogram/);
    expect((await draftState(store, f.fixtureId))?.placements).toHaveLength(2);
  });

  it("server-set ids win over anything smuggled in the fields", async () => {
    const { store, f, tee } = await setUp("pg-save-ids");
    await startDraft(store, f.fixtureId, null);
    const { row } = await loadPlanogram(store, f.fixtureId);
    if (!row) throw new Error("setup");
    const smuggled = { ...fields(f.faceId), id: "00000000-0000-4000-8000-00000000dead", storeId: "other", planogramId: "other", productId: f.productId };
    await withStore(store, changeStatements(store, row, { kind: "add", productId: tee, fields: smuggled }, tee));
    const added = (await draftState(store, f.fixtureId))?.placements.find((p) => p.col === 3);
    expect(added).toMatchObject({ productId: tee });
    expect(added?.id).not.toBe(smuggled.id);
  });

  it("removes a placement, guarded by its version", async () => {
    const { store, f } = await setUp("pg-remove");
    await startDraft(store, f.fixtureId, null);
    const pant = (await draftState(store, f.fixtureId))?.placements[0];
    if (!pant) throw new Error("setup");
    expect(await saveChange(store, f.fixtureId, { kind: "remove", id: pant.id, version: pant.version + 1 })).toEqual({ status: "conflict" });
    expect(await saveChange(store, f.fixtureId, { kind: "remove", id: pant.id, version: pant.version })).toEqual({ status: "saved" });
    expect((await draftState(store, f.fixtureId))?.placements).toEqual([]);
  });

  it("turning a side off removes its draft placements", async () => {
    const { store, f } = await setUp("pg-side-off");
    await startDraft(store, f.fixtureId, null);
    await db.delete(fixtureFaces).where(eq(fixtureFaces.id, f.faceId));
    expect(await db.select().from(planogramPlacements).where(eq(planogramPlacements.storeId, store))).toEqual([]);
  });
});

describe("discardDraft and setDueDate", () => {
  it("discards the whole draft, refusing a stale request", async () => {
    const { store, f } = await setUp("pg-discard");
    await startDraft(store, f.fixtureId, null);
    expect(await discardDraft(store, f.fixtureId, 7)).toEqual({ status: "conflict" });
    expect(await discardDraft(store, f.fixtureId, 1)).toEqual({ status: "saved" });
    const state = await loadPlanogram(store, f.fixtureId);
    expect(state.row).toMatchObject({ hasDraft: false, version: 2 });
    expect(state.draft).toBeNull();
    expect(await db.select().from(planogramPlacements).where(eq(planogramPlacements.storeId, store))).toEqual([]);
  });

  it("sets and clears a due date, creating the row on first use", async () => {
    const { store, f } = await setUp("pg-due");
    expect(await setDueDate(store, f.fixtureId, "2026-10-15")).toEqual({ status: "saved" });
    expect((await loadPlanogram(store, f.fixtureId)).row).toMatchObject({ dueDate: "2026-10-15", version: 1, hasDraft: false });
    expect(await setDueDate(store, f.fixtureId, null)).toEqual({ status: "saved" });
    expect((await loadPlanogram(store, f.fixtureId)).row?.dueDate).toBeNull();
  });

  it("a due date neither bumps the version nor clashes with a draft edit", async () => {
    const { store, f, tee } = await setUp("pg-due-draft");
    await startDraft(store, f.fixtureId, null);
    await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: fields(f.faceId) });
    const before = (await loadPlanogram(store, f.fixtureId)).row;
    expect(await setDueDate(store, f.fixtureId, "2026-11-01")).toEqual({ status: "saved" });
    const after = (await loadPlanogram(store, f.fixtureId)).row;
    expect(after).toMatchObject({ dueDate: "2026-11-01", version: before?.version, hasDraft: true });
    // A draft edit built before the due date still lands.
    const pant = (await draftState(store, f.fixtureId))?.placements.find((p) => p.productId === f.productId);
    if (!pant) throw new Error("setup");
    expect(await saveChange(store, f.fixtureId, { kind: "update", id: pant.id, version: pant.version, fields: { ...pant, row: 1 } })).toEqual({ status: "saved" });
  });

  it("keeps planograms per store", async () => {
    const a = await setUp("pg-iso-a");
    const b = await makeStore("pg-iso-b");
    await startDraft(a.store, a.f.fixtureId, null);
    expect(await startDraft(b, a.f.fixtureId, null)).toEqual({ status: "not-found" });
    expect(await draftState(b, a.f.fixtureId)).toBeNull();
  });
});
