import { describe, expect, it } from "vitest";

import { EMPTY_DRAWING, placeCorner, undoCorner } from "./outline-draw";

describe("placeCorner", () => {
  it("adds corners on whole inches, squared to the previous one", () => {
    let drawing = placeCorner(EMPTY_DRAWING, { x: 0.4, y: 0.2 }, 1).drawing;
    // 5 in off the line through the first corner: squared to it.
    drawing = placeCorner(drawing, { x: 240, y: 5 }, 1).drawing;
    expect(drawing.points).toEqual([
      { x: 0, y: 0 },
      { x: 240, y: 0 },
    ]);
  });

  it("closes on the first corner once there are three", () => {
    let drawing = EMPTY_DRAWING;
    for (const p of [{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 180 }]) drawing = placeCorner(drawing, p, 1).drawing;
    const result = placeCorner(drawing, { x: 4, y: 3 }, 1);
    expect(result.closed).toHaveLength(3);
    expect(result.drawing).toEqual(EMPTY_DRAWING);
  });

  it("ignores a second tap on the same spot", () => {
    const once = placeCorner(EMPTY_DRAWING, { x: 0, y: 0 }, 1).drawing;
    expect(placeCorner(once, { x: 1, y: 1 }, 1).drawing.points).toHaveLength(1);
  });
});

describe("placeCorner with two corners", () => {
  it("ignores a tap back on the first corner", () => {
    let drawing = placeCorner(EMPTY_DRAWING, { x: 0, y: 0 }, 1).drawing;
    drawing = placeCorner(drawing, { x: 240, y: 0 }, 1).drawing;
    const result = placeCorner(drawing, { x: 3, y: 2 }, 1);
    expect(result.drawing.points).toHaveLength(2);
    expect(result.closed).toBeNull();
  });
});

describe("undoCorner", () => {
  it("takes the last corner away", () => {
    const drawing = placeCorner(EMPTY_DRAWING, { x: 0, y: 0 }, 1).drawing;
    expect(undoCorner(drawing)).toEqual(EMPTY_DRAWING);
  });
});
