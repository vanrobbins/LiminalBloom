// The two palette answers as the browser reads them (CODESTYLE rule 5: nothing off the
// network is trusted). They mirror the payload types in types.ts.

import { z } from "zod";

import { PRODUCT_STATUSES } from "@/lib/products/schemas";

export const indexSchema = z.object({
  planograms: z.array(z.object({ fixtureId: z.string(), name: z.string(), typeHint: z.string().optional(), zoneName: z.string(), state: z.string(), published: z.literal(true).optional() })),
  zones: z.array(z.object({ id: z.string(), name: z.string(), fixtureCount: z.number() })),
});

export const productsSchema = z.object({
  products: z.array(z.object({ id: z.string(), name: z.string(), styleNumber: z.string(), status: z.enum(PRODUCT_STATUSES), place: z.string().nullable(), more: z.number(), adjustFixtureId: z.string().optional() })),
  total: z.number(),
});
