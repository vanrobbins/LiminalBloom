import { describe, expect, it } from "vitest";

import { categoryInput, fieldErrors, productInput, searchInput } from "./schemas";

const valid = {
  name: " High-Rise Pant ",
  styleNumber: "HRP-01",
  categoryId: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10",
  color: "Black",
  sizeRange: "24–34",
  status: "in_stock",
  overrides: { hung: null, folded: { columns: 2, rows: 2, stackLimit: 6 } },
};

describe("product input", () => {
  it("trims and accepts a valid product", () => {
    const parsed = productInput.parse(valid);
    expect(parsed.name).toBe("High-Rise Pant");
  });

  it("refuses an empty name and an out-of-range footprint, naming the field", () => {
    const result = productInput.safeParse({ ...valid, name: "  ", overrides: { hung: { columns: 25, rows: 1, stackLimit: 1 }, folded: null } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.name).toBe("Enter a name.");
      expect(errors.overrides).toBe("Footprints are 1 to 24 cells each way.");
    }
  });
});

describe("category input", () => {
  it("refuses a stack limit over 99", () => {
    expect(categoryInput.safeParse({ name: "Denim", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 100 }).success).toBe(false);
  });
});

describe("search input", () => {
  it("defaults the filters and caps the query", () => {
    const parsed = searchInput.parse({ q: "x".repeat(200) });
    expect(parsed.q).toHaveLength(80);
    expect(parsed).toMatchObject({ categoryIds: [], colors: [], statuses: [], places: [] });
  });
});
