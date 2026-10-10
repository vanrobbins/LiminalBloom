// Everything a planogram action receives, parsed before use (CODESTYLE rule 5).

import { z } from "zod";

import { PRESENTATIONS } from "@/lib/products/footprint";

import { EARLIEST_DUE_DATE, MAX_PIECES } from "./types";

const cell = z.int().min(0).max(23);
const span = z.int().min(1).max(24);

export const placementFields = z.object({
  faceId: z.uuid(),
  presentation: z.enum(PRESENTATIONS),
  col: cell,
  row: cell,
  colSpan: span,
  rowSpan: span,
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
