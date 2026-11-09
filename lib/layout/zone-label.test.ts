import { describe, expect, it } from "vitest";

import { zoneLabel } from "./zone-label";

const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe("zoneLabel", () => {
  it("sits in the top-left corner, full size when there is room", () => {
    const label = zoneLabel(rect(100, 50, 300, 200), "Front tables", 1)!;
    expect(label.text).toBe("Front tables");
    expect(label.fontSize).toBe(13);
    expect(label.x).toBe(106);
    expect(label.y).toBeLessThan(80);
  });

  it("shrinks to fit a narrow zone, then cuts with … rather than spill past the edge", () => {
    const shrunk = zoneLabel(rect(0, 0, 70, 200), "Stockroom", 1)!;
    expect(shrunk.text).toBe("Stockroom");
    expect(shrunk.fontSize).toBeLessThan(13);
    const cut = zoneLabel(rect(0, 0, 60, 200), "Fitting rooms", 1)!;
    expect(cut.text.endsWith("…")).toBe(true);
    expect(cut.fontSize).toBe(10);
    expect(cut.text.length * 0.56 * 10).toBeLessThanOrEqual(60 - 12);
  });

  it("scales with zoom: the same zone has more room zoomed in", () => {
    expect(zoneLabel(rect(0, 0, 60, 200), "Fitting rooms", 3)!.text).toBe("Fitting rooms");
  });

  it("says nothing for a sliver or a nameless zone", () => {
    expect(zoneLabel(rect(0, 0, 8, 200), "Aisle", 1)).toBeNull();
    expect(zoneLabel(rect(0, 0, 300, 200), "", 1)).toBeNull();
  });
});
