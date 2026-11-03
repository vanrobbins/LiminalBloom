import { describe, expect, it } from "vitest";

import { placementIssues } from "@/lib/products/placement";

import { buildDemo, textureFor } from "./build";
import { DEMO_PRODUCTS } from "./catalog";

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("buildDemo", () => {
  const plan = buildDemo("store_demo", newId);

  it("has the whole catalog with unique style numbers", () => {
    expect(plan.products).toHaveLength(50);
    expect(new Set(plan.products.map((p) => p.styleNumber.toLowerCase())).size).toBe(50);
    expect(plan.categories).toHaveLength(7);
  });

  it("places about 70% on the floor, some in bins, and leaves the planned few unplaced", () => {
    const placed = (kind: "floor" | "bin") => new Set(plan.locations.filter((l) => (kind === "floor" ? l.faceId : l.binId)).map((l) => l.productId));
    const floor = placed("floor").size;
    expect(floor / 50).toBeGreaterThanOrEqual(0.6);
    expect(placed("bin").size).toBeGreaterThanOrEqual(8);
    const unplanned = DEMO_PRODUCTS.filter((p) => p.plan === "-").length;
    const located = new Set(plan.locations.map((l) => l.productId));
    expect(plan.products.filter((p) => !located.has(p.id))).toHaveLength(unplanned);
  });

  it("puts every floor location inside its face and on top of nothing", () => {
    for (const face of plan.layout.faces) {
      const here = plan.locations.filter((l) => l.faceId === face.id).map((l) => ({ id: l.id, col: l.col!, row: l.row!, colSpan: l.colSpan!, rowSpan: l.rowSpan! }));
      expect(placementIssues({ columns: face.columns, rows: face.rows }, here)).toEqual([]);
    }
  });

  it("gives every product a swatch and a texture instead of an image", () => {
    for (const p of plan.products) {
      expect(p.imagePath).toBeNull();
      expect(p.swatch).toMatch(/^#[0-9a-f]{6}$/);
    }
    const textures = new Set(plan.products.map((p) => p.texture));
    expect([...textures].sort()).toEqual(["check", "denim", "dots", "rib", "solid", "stripes"]);
  });

  it("picks textures by category and a few names", () => {
    expect(textureFor("Denim", "Skinny Jean")).toBe("denim");
    expect(textureFor("Knits", "Cable Cardigan")).toBe("rib");
    expect(textureFor("Tees", "Ringer Tee")).toBe("stripes");
    expect(textureFor("Tees", "Everyday Crew Tee")).toBe("solid");
  });

  it("includes products that are sold out and on sale for the Week 7 demo", () => {
    expect(plan.products.some((p) => p.status === "sold_out")).toBe(true);
    expect(plan.products.some((p) => p.status === "on_sale")).toBe(true);
  });
});
