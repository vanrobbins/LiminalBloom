import { describe, expect, it } from "vitest";

import { centreOn, fit, panBy, scaleLimits, screenToWorld, viewCentre, worldToScreen, zoomAt } from "./camera";

const store = { minX: 0, minY: 0, maxX: 480, maxY: 360 };

describe("worldToScreen and screenToWorld", () => {
  it("are inverses", () => {
    const camera = { x: 10, y: 20, scale: 2 };
    expect(screenToWorld(camera, worldToScreen(camera, { x: 50, y: 70 }))).toEqual({ x: 50, y: 70 });
  });
});

describe("panBy", () => {
  it("moves the view with the finger", () => {
    // Dragging right by 20 px at 2 px/in shows what was 10 in to the left.
    expect(panBy({ x: 100, y: 100, scale: 2 }, 20, 0)).toEqual({ x: 90, y: 100, scale: 2 });
  });
});

describe("zoomAt", () => {
  it("keeps the point under the fingers still", () => {
    const camera = { x: 0, y: 0, scale: 1 };
    const at = { x: 100, y: 50 };
    const before = screenToWorld(camera, at);
    const after = screenToWorld(zoomAt(camera, at, 2, { min: 0.1, max: 4 }), at);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("stays within its limits", () => {
    expect(zoomAt({ x: 0, y: 0, scale: 3 }, { x: 0, y: 0 }, 10, { min: 0.1, max: 4 }).scale).toBe(4);
  });
});

describe("fit", () => {
  it("centres the store with padding", () => {
    const camera = fit(store, { width: 1000, height: 800 });
    const centre = viewCentre(camera, { width: 1000, height: 800 });
    expect(centre.x).toBeCloseTo(240, 9);
    expect(centre.y).toBeCloseTo(180, 9);
    expect(camera.scale).toBeCloseTo((1000 - 48) / 480, 9);
  });

  it("stays finite at zero size (Review Focus 3)", () => {
    const camera = fit(store, { width: 0, height: 0 });
    expect(Number.isFinite(camera.x)).toBe(true);
    expect(Number.isFinite(camera.y)).toBe(true);
    expect(camera.scale).toBeGreaterThan(0);
  });
});

describe("scaleLimits", () => {
  it("lets you zoom out to half of fit-the-store and in to 4 px per inch", () => {
    const limits = scaleLimits(store, { width: 1000, height: 800 });
    expect(limits.min).toBeCloseTo((1000 - 48) / 480 / 2, 9);
    expect(limits.max).toBe(4);
  });
});

describe("centreOn", () => {
  it("brings a point to the middle without changing zoom", () => {
    const camera = centreOn({ x: 0, y: 0, scale: 2 }, { width: 400, height: 300 }, { x: 500, y: 500 });
    expect(viewCentre(camera, { width: 400, height: 300 })).toEqual({ x: 500, y: 500 });
    expect(camera.scale).toBe(2);
  });
});
