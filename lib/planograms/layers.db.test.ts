// Hung layers against the dev database (DECISIONS 11-09): a hung product that
// lands on others joins at the back, Move forward swaps, leaving renumbers,
// and publish, Search's words and restore all keep the order.

import { afterAll, describe, expect, it } from "vitest";

import { locationsFor } from "@/lib/products/locations";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { publishDraft, restoreVersion } from "./publish";
import { draftState, loadPlanogram } from "./queries";
import { addFixture, addProduct } from "./test-planograms";
import { saveChange, startDraft } from "./write";

afterAll(dropStores);

const rail = (faceId: string, col: number, over = {}) => ({ faceId, presentation: "hung" as const, col, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 3, ...over });

describe("hung layers", () => {
  it("join at the back, reorder, leave, publish with words for Search, and restore in order", async () => {
    const store = await makeStore("pg-layers");
    const { categoryId } = await seedStoreFixtures(store);
    const rack = await addFixture(store, { faces: [{ side: "front", columns: 12, rows: 4 }] });
    const face = rack.faceIds.front!;
    const navy = await addProduct(store, categoryId, "Navy Tee");
    const sand = await addProduct(store, categoryId, "Sand Tee");
    const pant = await addProduct(store, categoryId, "Wide Pant");
    await startDraft(store, rack.fixtureId, null);
    const add = (productId: string, col: number, over = {}) => saveChange(store, rack.fixtureId, { kind: "add", productId, fields: rail(face, col, over) });
    const draft = async () => (await draftState(store, rack.fixtureId))?.placements ?? [];
    const depthOf = async (productId: string) => (await draft()).find((p) => p.productId === productId)?.depth;

    expect(await add(navy, 0)).toEqual({ status: "saved" });
    expect(await add(sand, 1)).toEqual({ status: "saved" });
    expect(await add(pant, 8)).toEqual({ status: "saved" });
    expect([await depthOf(navy), await depthOf(sand), await depthOf(pant)]).toEqual([0, 1, 0]);
    expect(await add(pant, 2, { presentation: "folded" })).toEqual({ status: "invalid", message: "Blocked by Navy Tee" });

    // The pant moves onto both: it joins at the back.
    const pantRow = (await draft()).find((p) => p.productId === pant)!;
    expect(await saveChange(store, rack.fixtureId, { kind: "update", id: pantRow.id, version: pantRow.version, fields: rail(face, 2) })).toEqual({ status: "saved" });
    expect(await depthOf(pant)).toBe(2);

    // Move forward: the sand tee asks for the front, and the navy tee steps back without a new version.
    const before = await draft();
    const sandRow = before.find((p) => p.productId === sand)!;
    const navyVersion = before.find((p) => p.productId === navy)!.version;
    expect(await saveChange(store, rack.fixtureId, { kind: "update", id: sandRow.id, version: sandRow.version, fields: { ...rail(face, 1), depth: 0 } })).toEqual({ status: "saved" });
    const after = await draft();
    expect(after.map((p) => [p.productId, p.depth]).sort()).toEqual([[navy, 1], [pant, 2], [sand, 0]].sort());
    expect(after.find((p) => p.productId === navy)!.version).toBe(navyVersion);

    const { row } = await loadPlanogram(store, rack.fixtureId);
    expect(await publishDraft(store, rack.fixtureId, row!.version, null, null, { id: null, name: "Van" })).toEqual({ status: "saved", number: 1 });
    const words = await locationsFor(store, [sand, navy, pant]);
    const of = (id: string) => words.find((w) => w.productId === id)!;
    expect(of(sand).detail).toMatch(/· front$/);
    expect(of(sand).behind).toBeNull();
    expect(of(navy).detail).toMatch(/· 2nd from front$/);
    expect(of(navy).behind).toBe("Behind Sand Tee");
    expect(of(pant).behind).toBe("Behind Navy Tee and Sand Tee");

    // Restore brings the order back, and leaving a group renumbers what stays.
    const published = await loadPlanogram(store, rack.fixtureId);
    expect(await restoreVersion(store, rack.fixtureId, published.row!.version, 1)).toEqual({ status: "saved", skipped: { product: 0, face: 0, fit: 0 } });
    expect([await depthOf(sand), await depthOf(navy), await depthOf(pant)]).toEqual([0, 1, 2]);
    const restoredSand = (await draft()).find((p) => p.productId === sand)!;
    await saveChange(store, rack.fixtureId, { kind: "update", id: restoredSand.id, version: restoredSand.version, fields: rail(face, 8, { colSpan: 2 }) });
    expect([await depthOf(sand), await depthOf(navy), await depthOf(pant)]).toEqual([0, 0, 1]);
  });
});
