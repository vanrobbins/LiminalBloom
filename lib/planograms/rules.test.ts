import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cellsOverlap, fitsGrid } from "@/lib/products/placement";

import { checkPlacement, draftIssues, type Neighbour } from "./rules";
import type { PlacementView, PlanogramFace } from "./types";

const front: PlanogramFace = { faceId: "front", fixtureId: "bay", fixtureName: "Denim Wall · Bay 3", side: "front", setSide: null, label: "Front", columns: 6, rows: 4 };
const pant: Neighbour = { id: "pant", faceId: "front", productName: "High-Rise Pant", col: 0, row: 0, colSpan: 2, rowSpan: 2 };
const sock = (over = {}) => ({ id: null, faceId: "front", presentation: "hung" as const, col: 2, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 1, ...over });

describe("checkPlacement", () => {
  it("accepts a placement in open cells", () => {
    expect(checkPlacement(sock(), [pant], [front], 8)).toBeNull();
  });

  it("names the product in the way", () => {
    expect(checkPlacement(sock({ col: 1 }), [pant], [front], 8)).toEqual({ kind: "overlap", message: "Blocked by High-Rise Pant", blockerId: "pant" });
  });

  it("ignores the placement being edited and other faces", () => {
    expect(checkPlacement({ ...sock({ col: 0 }), id: "pant" }, [pant], [front], 8)).toBeNull();
    expect(checkPlacement(sock({ col: 0 }), [{ ...pant, faceId: "back" }], [front], 8)).toBeNull();
  });

  it("refuses cells off the edge of the face", () => {
    expect(checkPlacement(sock({ col: 5, colSpan: 2 }), [], [front], 8)?.message).toBe("Off the edge of the face");
    expect(checkPlacement(sock({ row: 2, rowSpan: 3 }), [], [front], 8)?.message).toBe("Off the edge of the face");
  });

  it("refuses a face outside the planogram", () => {
    expect(checkPlacement(sock({ faceId: "elsewhere" }), [], [front], 8)?.message).toBe("No longer in this set");
  });

  it("caps folded pieces at the stack limit and hung pieces at 99", () => {
    expect(checkPlacement(sock({ presentation: "folded", pieceCount: 9, colSpan: 2, rowSpan: 2 }), [], [front], 8)?.message).toBe(
      "More than this product's stack limit (8)",
    );
    expect(checkPlacement(sock({ presentation: "folded", pieceCount: 8, colSpan: 2, rowSpan: 2 }), [], [front], 8)).toBeNull();
    expect(checkPlacement(sock({ pieceCount: 40 }), [], [front], 8)).toBeNull();
    expect(checkPlacement(sock({ pieceCount: 100 }), [], [front], 8)?.message).toBe("At most 99 pieces");
    expect(checkPlacement(sock({ pieceCount: 0 }), [], [front], 8)?.message).toBe("At least 1 piece");
  });

  it("never accepts a placement that overlaps another or leaves its face", () => {
    const cell = fc.record({ col: fc.integer({ min: 0, max: 7 }), row: fc.integer({ min: 0, max: 5 }), colSpan: fc.integer({ min: 1, max: 4 }), rowSpan: fc.integer({ min: 1, max: 4 }) });
    fc.assert(
      fc.property(fc.array(cell, { maxLength: 25 }), (candidates) => {
        const accepted: Neighbour[] = [];
        candidates.forEach((c, i) => {
          if (!checkPlacement({ ...c, id: null, faceId: "front", presentation: "hung", pieceCount: 1 }, accepted, [front], 8)) {
            accepted.push({ ...c, id: `p${i}`, faceId: "front", productName: `P${i}` });
          }
        });
        return accepted.every((a, i) => fitsGrid(a, front) && accepted.slice(0, i).every((b) => !cellsOverlap(a, b)));
      }),
    );
  });
});

describe("draftIssues", () => {
  const view = (id: string, over: Partial<PlacementView> = {}): PlacementView => ({
    id, faceId: "front", productId: id, productName: id, styleNumber: id, presentation: "folded", stackLimit: 8,
    col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 1, version: 1, ...over,
  });

  it("marks off-edge, overlapping and orphaned placements once each", () => {
    const issues = draftIssues([view("a"), view("b", { col: 1 }), view("c", { col: 5 }), view("d", { faceId: "gone", col: 3 })], [front]);
    expect([...issues]).toEqual([
      ["b", "Blocked by a"],
      ["c", "Off the edge of the face"],
      ["d", "No longer in this set"],
    ]);
  });
});
