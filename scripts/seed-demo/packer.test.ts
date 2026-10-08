import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { placementIssues } from "@/lib/products/placement";

import { pack, type FaceSlot } from "./packer";

const faces: FaceSlot[] = [
  { faceId: "table", grid: { columns: 6, rows: 3 }, accepts: ["folded"] },
  { faceId: "wall", grid: { columns: 4, rows: 5 }, accepts: ["hung", "folded"] },
];

describe("pack", () => {
  it("puts each request on the first face that takes it, top-left first", () => {
    const { placed } = pack(faces, [
      { productId: "a", presentation: "folded", columns: 2, rows: 2 },
      { productId: "b", presentation: "hung", columns: 1, rows: 4 },
    ]);
    expect(placed).toEqual([
      { productId: "a", presentation: "folded", columns: 2, rows: 2, faceId: "table", col: 0, row: 0 },
      { productId: "b", presentation: "hung", columns: 1, rows: 4, faceId: "wall", col: 0, row: 0 },
    ]);
  });

  it("never puts one product twice on the same face", () => {
    const { placed } = pack(faces, [
      { productId: "a", presentation: "folded", columns: 2, rows: 2 },
      { productId: "a", presentation: "folded", columns: 2, rows: 2 },
    ]);
    expect(placed.map((p) => p.faceId)).toEqual(["table", "wall"]);
  });

  it("reports what did not fit", () => {
    expect(pack(faces, [{ productId: "x", presentation: "hung", columns: 5, rows: 1 }]).unplaced).toHaveLength(1);
  });

  it("never overlaps or leaves a face, whatever is asked", () => {
    const request = fc.record({
      productId: fc.constantFrom("a", "b", "c", "d", "e"),
      presentation: fc.constantFrom("hung" as const, "folded" as const),
      columns: fc.integer({ min: 1, max: 4 }),
      rows: fc.integer({ min: 1, max: 5 }),
    });
    fc.assert(
      fc.property(fc.array(request, { maxLength: 40 }), (requests) => {
        const { placed } = pack(faces, requests);
        return faces.every((face) => {
          const here = placed.filter((p) => p.faceId === face.faceId);
          const accepted = here.every((p) => face.accepts.includes(p.presentation));
          const cells = here.map((p, i) => ({ id: String(i), col: p.col, row: p.row, colSpan: p.columns, rowSpan: p.rows }));
          return accepted && placementIssues(face.grid, cells).length === 0;
        });
      }),
    );
  });
});
