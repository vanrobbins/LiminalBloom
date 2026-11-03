// How much room (half-foot columns × rows) a product covers (§1.4 "Footprint"), hung or folded. A
// category sets the default and a product overrides it only where it differs
// (spec §4.3); this is the one place that decides which applies. The screens
// call it "Space on the fixture" (Week 6.5 spec §3.1); the code term stays.
// The size range follows the same model: the category's unless the product
// has its own (§3.4).

import { MAX_COLUMNS, MAX_ROWS, feetText } from "@/lib/feet";

export const PRESENTATIONS = ["hung", "folded"] as const;
export type Presentation = (typeof PRESENTATIONS)[number];

export const PRESENTATION_LABEL: Record<Presentation, string> = { hung: "Hung", folded: "Folded" };

/** Matches the face grid limit, so a footprint can always fit some face. */
export const MAX_FOOTPRINT_COLUMNS = MAX_COLUMNS;
export const MAX_FOOTPRINT_ROWS = MAX_ROWS;

// No stack limit (Week 6.5 spec §3.3): the piece count already says how many are in a stack.
export type Footprint = { columns: number; rows: number };

export type CategoryDefaults = {
  hungColumns: number;
  hungRows: number;
  foldedColumns: number;
  foldedRows: number;
};

export type Overrides = Partial<Record<Presentation, Footprint>>;

export function categoryFootprint(category: CategoryDefaults, presentation: Presentation): Footprint {
  return presentation === "hung"
    ? { columns: category.hungColumns, rows: category.hungRows }
    : { columns: category.foldedColumns, rows: category.foldedRows };
}

export function effectiveFootprint(
  category: CategoryDefaults,
  overrides: Overrides,
  presentation: Presentation,
): Footprint & { isOverride: boolean } {
  const override = overrides[presentation];
  return override
    ? { ...override, isOverride: true }
    : { ...categoryFootprint(category, presentation), isOverride: false };
}

/** The size only: "1½ ft wide, 2 rows high". */
export function describeSize(f: Footprint): string {
  return `${feetText(f.columns)} ft wide, ${f.rows} ${f.rows === 1 ? "row" : "rows"} high`;
}

/** "Hung: 1½ ft wide, 2 rows high". */
export function describeSpace(presentation: Presentation, f: Footprint): string {
  return `${PRESENTATION_LABEL[presentation]}: ${describeSize(f)}`;
}

/** Both presentations, for the category list. */
export function describeDefaults(c: CategoryDefaults): string {
  return `${describeSpace("hung", categoryFootprint(c, "hung"))} · ${describeSpace("folded", categoryFootprint(c, "folded"))}`;
}

/** Whether a product's own numbers are the category's anyway, so there is nothing to store. */
export function sameAsCategory(category: CategoryDefaults, presentation: Presentation, f: Footprint): boolean {
  const c = categoryFootprint(category, presentation);
  return c.columns === f.columns && c.rows === f.rows;
}

/** The product's own size range if it has one (even ""), else its category's. */
export function effectiveSizeRange(own: string | null, category: string): string {
  return own ?? category;
}

/** Quick picks for a size range; each fills the field, en dash included (spec §3.4). */
export const SIZE_PICKS = ["XS–XL", "S–XXL", "0–14", "24–34", "One size"] as const;
