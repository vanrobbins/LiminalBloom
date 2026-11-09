import { describe, expect, it } from "vitest";

import type { PlacementView } from "../types";

import { matchPlacement } from "./match";

const view = (id: string, over: Partial<PlacementView> = {}): PlacementView => ({
  depth: 0,
  id, faceId: "f", productId: "pant", productName: "Pant", styleNumber: "P", presentation: "folded",
  col: 0, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 6, version: 1, imageKey: null, categoryName: "", ...over,
});
const tile = { faceId: "f", productId: "pant", presentation: "folded" as const, col: 0, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 6 };

describe("matchPlacement", () => {
  it("finds the draft row a published tile became, even if its pieces changed", () => {
    expect(matchPlacement(tile, [view("other", { col: 6 }), view("mine", { pieceCount: 5 })])?.id).toBe("mine");
  });

  it("finds nothing when another device already moved it (Review Focus 3)", () => {
    expect(matchPlacement(tile, [view("moved", { col: 2 })])).toBeNull();
    expect(matchPlacement(tile, [view("hung", { presentation: "hung" })])).toBeNull();
  });
});
