// What a Quick Adjust action receives, parsed before use (CODESTYLE rule 5).

import { z } from "zod";

import { MAX_COLUMNS, MAX_ROWS } from "@/lib/feet";

import { MAX_DEPTH } from "./layers";
import { versionInput } from "./schemas";

/** The tile a change is about: where it sits in the version. Its spans, pieces and presentation come from the version. */
export const targetInput = z.object({
  faceId: z.uuid(),
  productId: z.uuid(),
  col: z.int().min(0).max(MAX_COLUMNS - 1),
  row: z.int().min(0).max(MAX_ROWS - 1),
  depth: z.int().min(0).max(MAX_DEPTH),
});

export const choiceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keep") }),
  z.object({ kind: z.literal("empty") }),
  z.object({ kind: z.literal("replace"), productId: z.uuid() }),
]);

/** The version of the tile's change row the screen read; null when the tile has no change yet. */
export const changeVersionInput = versionInput.nullable();
