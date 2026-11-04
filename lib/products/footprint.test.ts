import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MAX_FOOTPRINT_COLUMNS,
  MAX_FOOTPRINT_ROWS,
  categoryFootprint,
  describeDefaults,
  describeSpace,
  effectiveFootprint,
  effectiveSizeRange,
  sameAsCategory,
  type CategoryDefaults,
  type Footprint,
} from "./footprint";

const denim: CategoryDefaults = { hungColumns: 2, hungRows: 3, foldedColumns: 4, foldedRows: 2 };

describe("footprints", () => {
  it("uses the category default when there is no override", () => {
    expect(effectiveFootprint(denim, {}, "folded")).toEqual({ columns: 4, rows: 2, isOverride: false });
  });

  it("uses the product's override for that presentation only", () => {
    const overrides = { hung: { columns: 2, rows: 4 } };
    expect(effectiveFootprint(denim, overrides, "hung")).toEqual({ columns: 2, rows: 4, isOverride: true });
    expect(effectiveFootprint(denim, overrides, "folded").isOverride).toBe(false);
  });

  it("describes space in plain words", () => {
    expect(describeSpace("hung", { columns: 3, rows: 2 })).toBe("Hung: 1½ ft wide, 2 rows high");
    expect(describeSpace("folded", { columns: 4, rows: 1 })).toBe("Folded: 2 ft wide, 1 row high");
    expect(describeSpace("hung", { columns: 1, rows: 3 })).toBe("Hung: ½ ft wide, 3 rows high");
    expect(describeDefaults(denim)).toBe("Hung: 1 ft wide, 3 rows high · Folded: 2 ft wide, 2 rows high");
  });

  it("knows when a product's numbers are the category's anyway", () => {
    expect(sameAsCategory(denim, "hung", { columns: 2, rows: 3 })).toBe(true);
    expect(sameAsCategory(denim, "hung", { columns: 2, rows: 4 })).toBe(false);
  });

  it("inherits the category's size range unless the product has its own", () => {
    expect(effectiveSizeRange(null, "XS–XL")).toBe("XS–XL");
    expect(effectiveSizeRange("24–34", "XS–XL")).toBe("24–34");
    expect(effectiveSizeRange(null, "")).toBe("");
  });

  it("always lands inside the allowed ranges", () => {
    const size = fc.integer({ min: 1, max: MAX_FOOTPRINT_COLUMNS });
    const rowSize = fc.integer({ min: 1, max: MAX_FOOTPRINT_ROWS });
    const footprint = fc.record({ columns: size, rows: rowSize });
    fc.assert(
      fc.property(
        fc.record({ hungColumns: size, hungRows: rowSize, foldedColumns: size, foldedRows: rowSize }),
        fc.record({ hung: fc.option(footprint, { nil: undefined }), folded: fc.option(footprint, { nil: undefined }) }),
        fc.constantFrom("hung" as const, "folded" as const),
        (category, raw, presentation) => {
          const overrides: Partial<Record<"hung" | "folded", Footprint>> = {};
          if (raw.hung) overrides.hung = raw.hung;
          if (raw.folded) overrides.folded = raw.folded;
          const f = effectiveFootprint(category, overrides, presentation);
          const expected = overrides[presentation] ?? categoryFootprint(category, presentation);
          return f.columns === expected.columns && f.rows === expected.rows && f.columns >= 1 && f.columns <= MAX_FOOTPRINT_COLUMNS && f.rows >= 1 && f.rows <= MAX_FOOTPRINT_ROWS;
        },
      ),
    );
  });
});
