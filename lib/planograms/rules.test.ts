import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cellsOverlap, fitsGrid } from "@/lib/products/placement";

import { checkPlacement, draftIssues, type Neighbour } from "./rules";
import type { PlacementView, PlanogramFace } from "./types";

const front: PlanogramFace = { faceId: "front", fixtureId: "bay", fixtureName: "Denim Wall · Bay 3", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 6, rows: 4 };
const pant: Neighbour = { id: "pant", faceId: "front", productName: "High-Rise Pant", col: 0, row: 0, colSpan: 2, rowSpan: 2 };
const sock = (over = {}) => ({ id: null, faceId: "front", presentation: "hung" as const, col: 2, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 1, ...over });

describe("checkPlacement", () => {
  it("accepts a placement in open cells", () => {
    expect(checkPlacement(sock(), [pant], [front])).toBeNull();
  });

  it("names the product in the way", () => {
    expect(checkPlacement(sock({ col: 1 }), [pant], [front])).toEqual({ kind: "overlap", message: "Blocked by High-Rise Pant", blockerId: "pant" });
  });

  it("ignores the placement being edited and other faces", () => {
    expect(checkPlacement({ ...sock({ col: 0 }), id: "pant" }, [pant], [front])).toBeNull();
    expect(checkPlacement(sock({ col: 0 }), [{ ...pant, faceId: "back" }], [front])).toBeNull();
  });

  it("refuses cells off the edge of the face", () => {
    expect(checkPlacement(sock({ col: 5, colSpan: 2 }), [], [front])?.message).toBe("Off the edge of the face");
    expect(checkPlacement(sock({ row: 2, rowSpan: 3 }), [], [front])?.message).toBe("Off the edge of the face");
  });

  it("refuses a face outside the planogram", () => {
    expect(checkPlacement(sock({ faceId: "elsewhere" }), [], [front])?.message).toBe("No longer in this set");
  });

  it("caps folded and hung pieces at 99, with no stack limit (Week 6.5 spec §3.3)", () => {
    expect(checkPlacement(sock({ presentation: "folded", pieceCount: 40, colSpan: 2, rowSpan: 2 }), [], [front])).toBeNull();
    expect(checkPlacement(sock({ presentation: "folded", pieceCount: 100, colSpan: 2, rowSpan: 2 }), [], [front])?.message).toBe("At most 99 pieces");
    expect(checkPlacement(sock({ pieceCount: 40 }), [], [front])).toBeNull();
    expect(checkPlacement(sock({ pieceCount: 100 }), [], [front])?.message).toBe("At most 99 pieces");
    expect(checkPlacement(sock({ pieceCount: 0 }), [], [front])?.message).toBe("At least 1 piece");
  });

  it("never accepts a placement that overlaps another or leaves its face", () => {
    const cell = fc.record({ col: fc.integer({ min: 0, max: 7 }), row: fc.integer({ min: 0, max: 5 }), colSpan: fc.integer({ min: 1, max: 4 }), rowSpan: fc.integer({ min: 1, max: 4 }) });
    fc.assert(
      fc.property(fc.array(cell, { maxLength: 25 }), (candidates) => {
        const accepted: Neighbour[] = [];
        candidates.forEach((c, i) => {
          if (!checkPlacement({ ...c, id: null, faceId: "front", presentation: "hung", pieceCount: 1 }, accepted, [front])) {
            accepted.push({ ...c, id: `p${i}`, faceId: "front", productName: `P${i}` });
          }
        });
        return accepted.every((a, i) => fitsGrid(a, front) && accepted.slice(0, i).every((b) => !cellsOverlap(a, b)));
      }),
    );
  });
});

describe("hung layers (DECISIONS 11-09)", () => {
  const tee: Neighbour = { id: "tee", faceId: "front", productName: "Navy Tee", presentation: "hung", col: 0, row: 0, colSpan: 2, rowSpan: 2 };

  it("lets hung share rail space with hung, fully or partly", () => {
    expect(checkPlacement(sock({ col: 0, colSpan: 2, rowSpan: 2 }), [tee], [front])).toBeNull();
    expect(checkPlacement(sock({ col: 1, colSpan: 2, rowSpan: 2 }), [tee], [front])).toBeNull();
  });

  it("still refuses folded on hung and hung on folded", () => {
    expect(checkPlacement(sock({ presentation: "folded", col: 1, colSpan: 2, rowSpan: 2 }), [tee], [front])?.message).toBe("Blocked by Navy Tee");
    expect(checkPlacement(sock({ col: 1 }), [{ ...tee, presentation: "folded" }], [front])?.message).toBe("Blocked by Navy Tee");
  });
});

describe("draftIssues", () => {
  const view = (id: string, over: Partial<PlacementView> = {}): PlacementView => ({
    depth: 0,
    id, faceId: "front", productId: id, productName: id, styleNumber: id, presentation: "folded", imageKey: null, categoryName: "Denim",
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

  it("allows hung layers but flags two on the same layer", () => {
    const hung = { presentation: "hung" as const };
    expect(draftIssues([view("a", hung), view("b", { ...hung, col: 1, depth: 1 })], [front]).size).toBe(0);
    expect([...draftIssues([view("a", hung), view("b", { ...hung, col: 1 })], [front])]).toEqual([["b", "Same layer as a"]]);
  });
});

describe("frame racks", () => {
  const rail = { ...front, faceId: "rail", fixtureType: "frame_rack" as const, rows: 1 };
  it("hold hung product only, one row high", () => {
    expect(checkPlacement(sock({ faceId: "rail", presentation: "folded", rowSpan: 1, colSpan: 2 }), [], [rail])?.message).toBe("Frame racks hold hung product only");
    expect(checkPlacement(sock({ faceId: "rail", presentation: "hung", rowSpan: 1, colSpan: 2 }), [], [rail])).toBeNull();
    expect(checkPlacement(sock({ faceId: "rail", presentation: "hung", rowSpan: 2, colSpan: 2 }), [], [rail])?.message).toBe("Off the edge of the face");
  });
});

describe("onRail", () => {
  it("hangs folded product moved onto a frame rack, at its hung width, one row", async () => {
    const { onRail } = await import("./write");
    const scope = { fixtureId: "run", fixtureName: "Run", isSet: true, isRun: true, faces: [{ ...front, faceId: "rail", fixtureType: "frame_rack" as const, rows: 1 }, front] };
    const move = { kind: "update" as const, id: "p", version: 1, fields: { faceId: "rail", presentation: "folded" as const, col: 2, row: 1, colSpan: 4, rowSpan: 2, pieceCount: 6 } };
    expect(onRail(move, scope, 3)).toEqual({ ...move, fields: { ...move.fields, presentation: "hung", colSpan: 3, row: 0, rowSpan: 1 } });
    const elsewhere = { ...move, fields: { ...move.fields, faceId: "front" } };
    expect(onRail(elsewhere, scope, 3)).toBe(elsewhere);
  });
});
