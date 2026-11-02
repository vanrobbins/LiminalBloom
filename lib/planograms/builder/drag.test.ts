import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { setBlocks, singleBlock, spanRect, ROW_UNITS } from "../set-grid";
import type { PlacementFields, PlanogramFace } from "../types";

import { dragTarget } from "./drag";

const face = (faceId: string, setSide: PlanogramFace["setSide"], columns: number, rows: number): PlanogramFace => ({
  faceId, fixtureId: faceId, fixtureName: "T", fixtureType: "table", side: "top", setSide, label: faceId, columns, rows,
});
const tee: PlacementFields = { faceId: "u", presentation: "folded", col: 2, row: 0, colSpan: 4, rowSpan: 1, pieceCount: 3 };
const single = singleBlock(face("u", null, 12, 3));

describe("dragTarget", () => {
  it("snaps to half feet across and whole rows down, keeping the span", () => {
    expect(dragTarget(single, tee, 3.4, 2.6)).toEqual({ ...tee, col: 5, row: 1 });
    expect(dragTarget(single, tee, -0.4, 0.9)).toEqual(tee);
  });

  it("lands on the half foot nearest where the pointer took it, measured from the start", () => {
    fc.assert(
      fc.property(fc.double({ min: -1.9, max: 5.9, noNaN: true }), (dx) => {
        const target = dragTarget(single, tee, dx, 0);
        return target !== null && target.col === Math.round(tee.col + dx);
      }),
    );
  });

  it("leaves a tile hanging off the edge to the rules, and gives up only when its centre leaves every face", () => {
    expect(dragTarget(single, tee, 7, 0)).toEqual({ ...tee, col: 9 });
    expect(dragTarget(single, tee, -20, 0)).toBeNull();
  });

  it("moves onto another top of a set when the tile lands there", () => {
    const set = setBlocks([face("u", null, 12, 3), face("f", "front", 12, 2)]);
    const low = { ...tee, row: 2 };
    expect(dragTarget(set, low, 0, 3)).toEqual({ ...low, faceId: "f", row: 0 });
  });

  // Right lower: 6 columns x 2 rows, drawn turned at x 13..17, y 0..6. Its row 0
  // is drawn at the far (right) side, so a tile dropped on the far half is row 0.
  it("onto a turned right table, the span keeps its meaning along that table's own columns", () => {
    const set = setBlocks([face("u", null, 12, 3), face("r", "right", 6, 2)]);
    expect(dragTarget(set, tee, 12, 1)).toEqual({ ...tee, faceId: "r", col: 0, row: 0 });
    expect(dragTarget(set, tee, 10.2, 1)).toEqual({ ...tee, faceId: "r", col: 0, row: 1 });
  });

  it("draws a tile it drops anywhere on a face within a snap of where the pointer holds it", () => {
    const faces = [face("u", null, 12, 3), face("f", "front", 12, 2), face("l", "left", 6, 2), face("r", "right", 6, 2)];
    const layouts = [single, setBlocks(faces)];
    const starts: PlacementFields[] = [
      tee,
      { ...tee, faceId: "r", col: 1, row: 0, colSpan: 3, rowSpan: 1 },
      { ...tee, faceId: "l", col: 0, row: 1, colSpan: 2, rowSpan: 1 },
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...layouts),
        fc.constantFrom(...starts),
        fc.double({ min: -25, max: 25, noNaN: true }),
        fc.double({ min: -25, max: 25, noNaN: true }),
        (layout, start, dx, dy) => {
          const from = layout.blocks.find((b) => b.faceId === start.faceId);
          if (!from) return true;
          const drawn = spanRect(from, start);
          const result = dragTarget(layout, start, dx, dy);
          if (!result) return true;
          const to = layout.blocks.find((b) => b.faceId === result.faceId)!;
          const got = spanRect(to, result);
          // Compare centres: the tile turns with the face it lands on. A column
          // snaps to half a unit, a row to half a row.
          const gotX = got.x + got.width / 2;
          const gotY = got.y + got.height / 2;
          const wantX = drawn.x + dx + drawn.width / 2;
          const wantY = drawn.y + dy + drawn.height / 2;
          const tolX = to.turned ? ROW_UNITS / 2 : 0.5;
          const tolY = to.turned ? 0.5 : ROW_UNITS / 2;
          return Math.abs(gotX - wantX) <= tolX + 1e-9 && Math.abs(gotY - wantY) <= tolY + 1e-9;
        },
      ),
      { numRuns: 2000 },
    );
  });
});
