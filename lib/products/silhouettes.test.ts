import { describe, expect, it } from "vitest";

import { SILHOUETTE_PATHS, silhouetteFor, silhouetteSvg } from "./silhouettes";

describe("silhouettes", () => {
  it("picks a garment shape from the category name", () => {
    expect(["Tees", "Knits", "Denim", "Pants", "Dresses", "Outerwear", "Accessories", "Gift cards"].map(silhouetteFor)).toEqual([
      "tee", "knit", "pants", "pants", "dress", "outerwear", "accessory", "tee",
    ]);
  });

  it("draws an SVG in the product's color", () => {
    const svg = silhouetteSvg("dress", "#7a2e3b");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#7a2e3b"');
    expect(svg).toContain(SILHOUETTE_PATHS.dress);
  });

  it("refuses a fill that could break out of the attribute", () => {
    expect(() => silhouetteSvg("tee", '"><script>')).toThrow();
  });
});
