import { describe, expect, it } from "vitest";

import { SILHOUETTE_PATHS, silhouetteFor, silhouetteSvg } from "./silhouettes";

describe("silhouettes", () => {
  it("picks a garment shape from the category name", () => {
    expect(["Tees", "Knits", "Denim", "Pants", "Dresses", "Outerwear", "Accessories", "Gift cards"].map((category) => silhouetteFor(category))).toEqual([
      "tee", "knit", "pants", "pants", "dress", "outerwear", "accessory", "tee",
    ]);
  });

  it("draws a cap, beanie or hat as a hat, from the product's name", () => {
    expect(silhouetteFor("Accessories", "Baseball Cap")).toBe("hat");
    expect(silhouetteFor("Accessories", "Knit Beanie")).toBe("hat");
    expect(silhouetteFor("Hats")).toBe("hat");
    expect(silhouetteFor("Accessories", "Crossbody Bag")).toBe("accessory");
    expect(silhouetteFor("Tops", "Cap Sleeve Top")).toBe("tee");
    expect(silhouetteFor("Cap-sleeve tees")).toBe("tee");
  });

  it("reads short as shorts, never short-sleeve", () => {
    expect(silhouetteFor("Shorts")).toBe("pants");
    expect(silhouetteFor("Pants", "Chino Short")).toBe("pants");
    expect(silhouetteFor("Short-Sleeve Tees")).toBe("tee");
    expect(silhouetteFor("Short sleeve shirts")).toBe("tee");
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
