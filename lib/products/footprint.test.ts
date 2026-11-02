import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MAX_FOOTPRINT_COLUMNS,
  MAX_FOOTPRINT_ROWS,
  MAX_STACK,
  categoryFootprint,
  describeDefaults,
  describeFootprint,
  effectiveFootprint,
  type CategoryDefaults,
  type Footprint,
} from "./footprint";

const denim: CategoryDefaults = { hungColumns: 2, hungRows: 3, foldedColumns: 4, foldedRows: 2, stackLimit: 8 };

describe("footprints", () => {
  it("uses the category default when there is no override", () => {
    expect(effectiveFootprint(denim, {}, "folded")).toEqual({ columns: 4, rows: 2, stackLimit: 8, isOverride: false });
  });

  it("uses the product's override for that presentation only", () => {
    const overrides = { hung: { columns: 2, rows: 4, stackLimit: 3 } };
    expect(effectiveFootprint(denim, overrides, "hung")).toEqual({ columns: 2, rows: 4, stackLimit: 3, isOverride: true });
    expect(effectiveFootprint(denim, overrides, "folded").isOverride).toBe(false);
  });

  it("describes footprints the way the form shows them", () => {
    expect(describeFootprint({ columns: 2, rows: 3 })).toBe("1 ft × 3");
    expect(describeDefaults(denim)).toBe("Hung 1 ft × 3 · Folded 2 ft × 2 · Stack 8");
  });

  it("always lands inside the allowed ranges", () => {
    const size = fc.integer({ min: 1, max: MAX_FOOTPRINT_COLUMNS });
    const rowSize = fc.integer({ min: 1, max: MAX_FOOTPRINT_ROWS });
    const stack = fc.integer({ min: 1, max: MAX_STACK });
    const footprint = fc.record({ columns: size, rows: rowSize, stackLimit: stack });
    fc.assert(
      fc.property(
        fc.record({ hungColumns: size, hungRows: rowSize, foldedColumns: size, foldedRows: rowSize, stackLimit: stack }),
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
