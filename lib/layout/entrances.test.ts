import { describe, expect, it } from "vitest";

import { dragEntranceEnd, entranceEnds, isOnWall, nearestWall, placeOnWall, wallSpan } from "./entrances";
import { MAX_ENTRANCE_WIDTH } from "./limits";
import type { Entrance, Point } from "./types";

// A 40 ft × 30 ft store.
const outline: Point[] = [
  { x: 0, y: 0 },
  { x: 480, y: 0 },
  { x: 480, y: 360 },
  { x: 0, y: 360 },
];

const entrance = (over: Partial<Entrance> = {}): Entrance => ({
  id: "e",
  x: 240,
  y: 360,
  width: 72,
  version: 0,
  ...over,
});

describe("nearestWall", () => {
  it("finds the bottom wall for a point near it", () => {
    expect(nearestWall(outline, { x: 100, y: 350 })).toMatchObject({ index: 2, distance: 10 });
  });
});

describe("isOnWall", () => {
  it("accepts an entrance centred on a wall", () => {
    expect(isOnWall(entrance(), outline)).toBe(true);
  });

  it("rejects one off the wall or hanging past its end", () => {
    expect(isOnWall(entrance({ y: 340 }), outline)).toBe(false);
    expect(isOnWall(entrance({ x: 20 }), outline)).toBe(false);
  });
});

describe("placeOnWall", () => {
  it("leaves a good entrance exactly as it is", () => {
    const e = entrance();
    expect(placeOnWall(e, outline)).toBe(e);
  });

  it("moves a stray entrance onto the nearest wall", () => {
    expect(placeOnWall(entrance({ y: 340 }), outline)).toMatchObject({ x: 240, y: 360 });
  });

  it("slides one hanging past a corner back along the wall", () => {
    expect(placeOnWall(entrance({ x: 10 }), outline)).toMatchObject({ x: 36, y: 360 });
  });
});

describe("entranceEnds and wallSpan", () => {
  it("are the two ends of the opening along its wall", () => {
    expect(entranceEnds(entrance(), outline)).toEqual([
      { x: 276, y: 360 },
      { x: 204, y: 360 },
    ]);
    expect(wallSpan(entrance(), outline)).toEqual({ index: 2, from: 204, to: 276 });
  });
});

describe("dragEntranceEnd", () => {
  it("keeps the other end still", () => {
    // Drag the "end" end (the left one, x 204) out to x 180.
    expect(dragEntranceEnd(entrance(), outline, "end", { x: 180, y: 370 })).toEqual({
      x: 228,
      y: 360,
      width: 96,
    });
  });

  it("never makes the opening narrower than 3 ft", () => {
    expect(dragEntranceEnd(entrance(), outline, "end", { x: 275, y: 360 }).width).toBe(36);
  });

  it("slides the opening back onto the wall when it would hang past a corner", () => {
    // Entrance at x 56, width 72; drag start end to x 0.
    // Fixed end is x 20 (t ≈ 0.958); width clamps to 36, which slides
    // the fixed end from x 20 to x 36 to keep both ends on the wall.
    const e = entrance({ x: 56 });
    const result = dragEntranceEnd(e, outline, "start", { x: 0, y: 370 });
    expect(isOnWall({ ...e, ...result }, outline)).toBe(true);
    expect(result.width).toBe(36);
    expect(result.x).toBe(18);
  });

  it("handles dragging the start end", () => {
    // Entrance at x 240, width 72; drag start end to x 330 (negative direction).
    // Width = |0.3125 − 0.575| × 480 = 126 in.
    const e = entrance();
    const result = dragEntranceEnd(e, outline, "start", { x: 330, y: 370 });
    expect(result.width).toBe(126);
    expect(result.x).toBeCloseTo(267, 0);
    expect(isOnWall({ ...e, ...result }, outline)).toBe(true);
  });

  it("clamps to maximum entrance width", () => {
    // Drag the end end all the way to the opposite corner.
    const e = entrance();
    const result = dragEntranceEnd(e, outline, "end", { x: 0, y: 370 });
    expect(result.width).toBe(MAX_ENTRANCE_WIDTH);
    expect(isOnWall({ ...e, ...result }, outline)).toBe(true);
  });

  it("slides on the direction −1 branch when opening would overshoot t = 0", () => {
    // Entrance near the wall start (x ≈ 440, width 72).
    // Drag the "end" end to x 480; width clamps to 36 and slides to fit.
    const e = entrance({ x: 440 });
    const result = dragEntranceEnd(e, outline, "end", { x: 480, y: 370 });
    expect(result.width).toBe(36);
    expect(result.x).toBe(462);
    expect(isOnWall({ ...e, ...result }, outline)).toBe(true);
  });

  it("handles the pointer crossing the fixed end (flip)", () => {
    // Drag the "end" end past the start end to x 300; direction flips to −1.
    // Width = |0.375 − 0.425| × 480 = 24, clamped to 36.
    const e = entrance();
    const result = dragEntranceEnd(e, outline, "end", { x: 300, y: 370 });
    expect(result.width).toBe(36);
    expect(result.x).toBe(294);
    expect(isOnWall({ ...e, ...result }, outline)).toBe(true);
  });
});
