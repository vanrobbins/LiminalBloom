import { describe, expect, it } from "vitest";

import { indexSchema, productsSchema } from "./schema";

describe("palette answers read in the browser", () => {
  it("accepts what the server sends", () => {
    const index = { planograms: [{ fixtureId: "f", name: "Rack 1", zoneName: "Men", state: "Draft" }], zones: [{ id: "z", name: "Men", fixtureCount: 2 }] };
    expect(indexSchema.safeParse(index).success).toBe(true);
    const products = { products: [{ id: "p", name: "Tee", styleNumber: "T-1", status: "sold_out", place: null, more: 0 }], total: 1 };
    expect(productsSchema.safeParse(products).success).toBe(true);
  });

  it("keeps the Quick Adjust fields (they are not stripped)", () => {
    const index = { planograms: [{ fixtureId: "f", name: "Rack 1", zoneName: "Men", state: "Version 2", published: true }], zones: [] };
    expect(indexSchema.parse(index).planograms[0]).toMatchObject({ published: true });
    const products = { products: [{ id: "p", name: "Tee", styleNumber: "T-1", status: "sold_out", place: null, more: 0, adjustFixtureId: "fx" }], total: 1 };
    expect(productsSchema.parse(products).products[0]).toMatchObject({ adjustFixtureId: "fx" });
  });

  it("rejects a wrong shape or an unknown status", () => {
    expect(indexSchema.safeParse({ planograms: "x" }).success).toBe(false);
    expect(productsSchema.safeParse({ products: [{ id: "p", name: "Tee", styleNumber: "T", status: "lost", place: null, more: 0 }], total: 1 }).success).toBe(false);
  });
});
