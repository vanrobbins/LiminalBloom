// Everything a planogram action receives, parsed before use (CODESTYLE rule 5).

import { z } from "zod";

import { MAX_COLUMNS, MAX_ROWS } from "@/lib/feet";
import { PRESENTATIONS } from "@/lib/products/footprint";

import { EARLIEST_DUE_DATE, MAX_PIECES } from "./types";

const col = z.int().min(0).max(MAX_COLUMNS - 1);
const row = z.int().min(0).max(MAX_ROWS - 1);
const colSpan = z.int().min(1).max(MAX_COLUMNS);
const rowSpan = z.int().min(1).max(MAX_ROWS);

export const placementFields = z.object({
  faceId: z.uuid(),
  presentation: z.enum(PRESENTATIONS),
  col,
  row,
  colSpan,
  rowSpan,
  pieceCount: z.int().min(1).max(MAX_PIECES),
});

export const versionInput = z.int().min(1);

export const changeInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add"), productId: z.uuid(), fields: placementFields }),
  z.object({ kind: z.literal("update"), id: z.uuid(), version: versionInput, fields: placementFields }),
  z.object({ kind: z.literal("remove"), id: z.uuid(), version: versionInput }),
]);

export const dueDateInput = z.iso
  .date()
  .refine((d) => d >= EARLIEST_DUE_DATE)
  .nullable();

export const summaryInput = z
  .string()
  .trim()
  .max(200)
  .transform((s) => (s === "" ? null : s));
