// Everything that arrives from a form or the search box, parsed before use
// (CODESTYLE TypeScript rule 5). Messages are written for the person filling
// in the form, since they are shown beside the field.

import { z } from "zod";

import { MAX_CELLS, MAX_STACK } from "./footprint";

export const PRODUCT_STATUSES = ["in_stock", "sold_out", "on_sale"] as const;
export const PLACES = ["floor", "stockroom", "unplaced"] as const;
export type Place = (typeof PLACES)[number];

const FOOTPRINT_MESSAGE = `Footprints are 1 to ${MAX_CELLS} cells each way.`;
const cells = z.int(FOOTPRINT_MESSAGE).min(1, FOOTPRINT_MESSAGE).max(MAX_CELLS, FOOTPRINT_MESSAGE);
const stack = z.int(`Stack limits are 1 to ${MAX_STACK}.`).min(1, `Stack limits are 1 to ${MAX_STACK}.`).max(MAX_STACK, `Stack limits are 1 to ${MAX_STACK}.`);
const text = (label: string, max: number) =>
  z.string().trim().min(1, `Enter ${label}.`).max(max, `Keep ${label} under ${max} characters.`);

export const footprintInput = z.object({ columns: cells, rows: cells, stackLimit: stack });

export const productInput = z.object({
  name: text("a name", 120),
  styleNumber: text("a style number", 40),
  categoryId: z.uuid("Choose a category."),
  color: text("a color", 40),
  sizeRange: z.string().trim().max(40, "Keep the size range under 40 characters."),
  status: z.enum(PRODUCT_STATUSES),
  overrides: z.object({ hung: footprintInput.nullable(), folded: footprintInput.nullable() }),
});
export type ProductInput = z.infer<typeof productInput>;

export const categoryInput = z.object({
  name: text("a name", 60),
  hungColumns: cells,
  hungRows: cells,
  foldedColumns: cells,
  foldedRows: cells,
  stackLimit: stack,
});
export type CategoryInput = z.infer<typeof categoryInput>;

export const statusInput = z.enum(PRODUCT_STATUSES);

/** The most categories, or colors, one search takes. The filter chips stop here too. */
export const MAX_FILTER_CHOICES = 20;

export const searchInput = z.object({
  q: z.string().default("").transform((q) => q.slice(0, 80)),
  categoryIds: z.array(z.uuid()).max(MAX_FILTER_CHOICES).default([]),
  colors: z.array(z.string().trim().max(40)).max(MAX_FILTER_CHOICES).default([]),
  statuses: z.array(z.enum(PRODUCT_STATUSES)).max(3).default([]),
  places: z.array(z.enum(PLACES)).max(3).default([]),
});
export type SearchInput = z.infer<typeof searchInput>;

/** The first message for each top-level field, for showing beside it. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
