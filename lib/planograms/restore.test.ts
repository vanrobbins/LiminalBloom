import { describe, expect, it } from "vitest";

import { restoreMessage, restoreRows } from "./restore";
import type { PlanogramFace, ProductFit, SnapshotEntry } from "./types";

const front: PlanogramFace = { faceId: "front", fixtureId: "rack", fixtureName: "Rack", side: "front", setSide: null, label: "Front", columns: 4, rows: 4 };
const entry = (over: Partial<SnapshotEntry>): SnapshotEntry => ({
  faceId: "front", faceLabel: "Front", side: "front", fixtureId: "rack", fixtureName: "Rack", productId: "pant",
  productName: "High-Rise Pant", styleNumber: "HRP", presentation: "folded", col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 8, ...over,
});
const fit = (id: string, stackLimit = 8): ProductFit => ({
  id, name: id, styleNumber: id,
  footprints: { hung: { columns: 1, rows: 3, stackLimit }, folded: { columns: 2, rows: 2, stackLimit } },
});

describe("restoreRows", () => {
  it("restores what still fits and counts what doesn't, by reason", () => {
    const { rows, skipped } = restoreRows(
      [
        entry({}),
        entry({ productId: "gone", col: 2 }),
        entry({ faceId: "back", faceLabel: "Back", col: 2 }),
        entry({ productId: "tee", col: 3 }), // off the edge of a 4-wide face
      ],
      [front],
      new Map([["pant", fit("pant")], ["tee", fit("tee")]]),
    );
    expect(rows).toEqual([{ productId: "pant", faceId: "front", presentation: "folded", col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 8 }]);
    expect(skipped).toEqual({ product: 1, face: 1, fit: 1 });
  });

  it("lowers a folded count to a stack limit that has since shrunk", () => {
    const { rows } = restoreRows([entry({ pieceCount: 8 })], [front], new Map([["pant", fit("pant", 5)]]));
    expect(rows[0].pieceCount).toBe(5);
  });
});

describe("restoreMessage", () => {
  it("names the version and each reason", () => {
    expect(restoreMessage(3, { product: 0, face: 0, fit: 0 })).toBe("Restored version 3 as a draft.");
    expect(restoreMessage(3, { product: 2, face: 1, fit: 0 })).toBe(
      "Restored version 3 as a draft. 2 products skipped: no longer in the library. 1 product skipped: its side is no longer on the fixture.",
    );
  });
});
