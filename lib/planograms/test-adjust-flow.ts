// A published planogram with a Quick Adjust to work on, for the adjustment write/publish DB tests:
// a store whose table holds one High-Rise Pant (2x2 folded at 0,0) as Version 1, and a Slim Jean to replace it with.

import { loadPlanogram } from "./queries";
import { publishDraft } from "./publish";
import { openAdjustment } from "./adjust-write";
import { addProduct } from "./test-planograms";
import { saveChange, startDraft } from "./write";
import { makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

export const VAN = { id: null, name: "Van" };

export async function publishedPlanogram(label: string, second = false) {
  const store = await makeStore(label);
  const f = await seedStoreFixtures(store);
  const slim = await addProduct(store, f.categoryId, "Slim Jean");
  const tee = await addProduct(store, f.categoryId, "Pocket Tee");
  await startDraft(store, f.fixtureId, null);
  // `second`: a Pocket Tee tile beside the pant, so a version has two tiles.
  if (second) await saveChange(store, f.fixtureId, { kind: "add", productId: tee, fields: { faceId: f.faceId, presentation: "folded", col: 4, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 3 } });
  const { draft } = await loadPlanogram(store, f.fixtureId);
  await publishDraft(store, f.fixtureId, draft?.planogramVersion ?? 0, null, null, VAN);
  // The pant's tile, as a change names it.
  const target = { faceId: f.faceId, productId: f.productId, col: 0, row: 0, depth: 0 };
  return { store, f, slim, tee, target, teeTarget: { ...target, productId: tee, col: 4 } };
}
export type Published = Awaited<ReturnType<typeof publishedPlanogram>>;

export async function openDraft(s: Published) {
  const opened = await openAdjustment(s.store, s.f.fixtureId, "Sam");
  if (opened.status !== "saved") throw new Error("setup");
  return opened.draft;
}
