import { describe, expect, it } from "vitest";

import { DRAWINGS, SHAPES, VIEWS, drawingFor, viewFor } from "./drawings";

const PATH = /^[MLHVQACZ0-9\s.\-]+$/;

describe("drawings", () => {
  it("has every view of every shape, each with a body and details", () => {
    for (const shape of SHAPES) {
      for (const view of VIEWS) {
        const d = DRAWINGS[shape][view];
        expect(d.body, `${shape} ${view} body`).toMatch(PATH);
        expect(d.details, `${shape} ${view} details`).toMatch(PATH);
        expect(d.body.length, `${shape} ${view}`).toBeGreaterThan(10);
      }
    }
  });

  it("keeps every coordinate inside the 100 × 120 box", () => {
    for (const shape of SHAPES) {
      for (const view of VIEWS) {
        const { body, details } = DRAWINGS[shape][view];
        // Arc commands carry radii and flags; the numbers left are coordinates or radii, all small.
        const numbers = `${body} ${details}`.match(/-?\d+(\.\d+)?/g)!.map(Number);
        expect(Math.min(...numbers), `${shape} ${view}`).toBeGreaterThanOrEqual(0);
        expect(Math.max(...numbers), `${shape} ${view}`).toBeLessThanOrEqual(120);
      }
    }
  });

  it("picks a shape from the category, and the product's name settles the rest", () => {
    const fromCategory = ["Tees", "Tanks", "Knits", "Denim", "Pants", "Shorts", "Skirts", "Dresses", "Outerwear", "Accessories", "Shoes", "Gift cards"].map((c) => drawingFor(c));
    expect(fromCategory).toEqual(["tee", "tank", "knit", "pants", "pants", "shorts", "skirt", "dress", "outerwear", "bag", "shoes", "tee"]);
    expect(drawingFor("Accessories", "Baseball Cap")).toBe("hat");
    expect(drawingFor("Accessories", "Leather Belt")).toBe("scarf");
    expect(drawingFor("Accessories", "Wool Scarf")).toBe("scarf");
    expect(drawingFor("Accessories", "Canvas Tote")).toBe("bag");
    expect(drawingFor("Accessories", "Chunky Sneaker")).toBe("shoes");
    expect(drawingFor("Tops", "Silk Cami")).toBe("tank");
    expect(drawingFor("Bottoms", "Pleated Midi Skirt")).toBe("skirt");
    expect(drawingFor("Pants", "Chino Short")).toBe("shorts");
  });

  it("never reads cap sleeve as a cap, or short sleeve as shorts", () => {
    expect(drawingFor("Tops", "Cap Sleeve Top")).toBe("tee");
    expect(drawingFor("Cap-sleeve tees")).toBe("tee");
    expect(drawingFor("Tops", "Cap–sleeve Top")).toBe("tee");
    expect(drawingFor("Short-Sleeve Tees")).toBe("tee");
    expect(drawingFor("Tees", "Short Sleeve Crew")).toBe("tee");
  });

  it("draws hung as it hangs, and folded from above only on a table top", () => {
    expect(viewFor("hung", "front")).toBe("hung");
    expect(viewFor("folded", "top")).toBe("folded-top");
    expect(viewFor("folded", "left")).toBe("folded-front");
    expect(viewFor("hung", "top")).toBe("hung");
  });
});
