// How many cells a product covers (§1.4 "Footprint"), hung or folded. A
// category sets the default and a product overrides it only where it differs
// (spec §4.3); this is the one place that decides which applies.

export const PRESENTATIONS = ["hung", "folded"] as const;
export type Presentation = (typeof PRESENTATIONS)[number];

export const PRESENTATION_LABEL: Record<Presentation, string> = { hung: "Hung", folded: "Folded" };

/** Matches the face grid limit, so a footprint can always fit some face. */
export const MAX_CELLS = 24;
export const MAX_STACK = 99;

export type Footprint = { columns: number; rows: number; stackLimit: number };

export type CategoryDefaults = {
  hungColumns: number;
  hungRows: number;
  foldedColumns: number;
  foldedRows: number;
  stackLimit: number;
};

export type Overrides = Partial<Record<Presentation, Footprint>>;

export function categoryFootprint(category: CategoryDefaults, presentation: Presentation): Footprint {
  return presentation === "hung"
    ? { columns: category.hungColumns, rows: category.hungRows, stackLimit: category.stackLimit }
    : { columns: category.foldedColumns, rows: category.foldedRows, stackLimit: category.stackLimit };
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

export function describeFootprint(f: { columns: number; rows: number }): string {
  return `${f.columns} × ${f.rows}`;
}

export function describeDefaults(c: CategoryDefaults): string {
  return `Hung ${describeFootprint({ columns: c.hungColumns, rows: c.hungRows })} · Folded ${describeFootprint({ columns: c.foldedColumns, rows: c.foldedRows })} · Stack ${c.stackLimit}`;
}
