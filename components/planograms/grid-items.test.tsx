import { describe, expect, it } from "vitest";

import type { DraftState, PlanogramFace, PlanogramScope, SnapshotEntry } from "@/lib/planograms/types";

import { itemsFromSnapshot, startFace } from "./grid-items";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack", side: "front", setSide: null, label, columns: 6, rows: 4 });
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack", isSet: false, faces: [face("front", "Front"), face("back", "Back")] };
const at = (faceId: string, productId: string) => ({ faceId, productId, presentation: "hung" as const, col: 0, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 1 });
const shown = [{ ...at("back", "pant"), faceLabel: "Back", side: "back", fixtureId: "r", fixtureName: "Rack", productName: "Pant", styleNumber: "P" } as SnapshotEntry];
const draft: DraftState = { planogramVersion: 3, placements: [{ ...at("back", "tee"), id: "d", version: 1, productName: "Tee", styleNumber: "T", stackLimit: 8, imageKey: null, categoryName: "Denim" }] };
const entry = (over: Partial<SnapshotEntry>): SnapshotEntry => ({ ...shown[0], ...over });

describe("itemsFromSnapshot", () => {
  it("joins each snapshot entry to its product's look; a deleted product falls back (Review Focus 2)", () => {
    const entries = [entry({ productId: "kept" }), entry({ productId: "gone", productName: "Old Pant" })];
    const items = itemsFromSnapshot(entries, { kept: { imageKey: "k.webp", categoryName: "Denim" } });
    expect(items[0]).toMatchObject({ imageKey: "k.webp", categoryName: "Denim" });
    expect(items[1]).toMatchObject({ imageKey: null, categoryName: "", productName: "Old Pant" });
  });
});

describe("startFace", () => {
  it("opens on the face holding the highlighted product: the shown version first, else the draft", () => {
    expect(startFace(scope, shown, null, "pant")).toBe("back");
    expect(startFace(scope, [], draft, "tee")).toBe("back");
  });

  it("falls back to the first face", () => {
    expect(startFace(scope, shown, draft, null)).toBe("front");
    expect(startFace(scope, shown, draft, "sock")).toBe("front");
  });
});
