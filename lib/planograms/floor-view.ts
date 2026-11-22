// Every published planogram in a store at once, for the map (spec §5): the
// map shows what is on the floor, so only the latest version with its published Quick Adjust applied
// (0.7.0.9 spec §6.4), plus whether a draft is in progress and when it is due. One store-scoped batch.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { planograms, planogramVersions } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";

import { adjustedFloor } from "./adjust";
import { adjustmentQueries, adjustmentsOf } from "./adjust-queries";
import { parseSnapshot } from "./snapshot";
import type { FloorPlanogram } from "./types";

export type { FloorPlanogram };

export async function floorPlanograms(storeId: string): Promise<Record<string, FloorPlanogram>> {
  const [rows, adjustmentRows, changeRows] = await withStore(storeId, [
    db
      .select({ id: planograms.id, fixtureId: planograms.fixtureId, hasDraft: planograms.hasDraft, dueDate: planograms.dueDate, number: planogramVersions.number, placements: planogramVersions.placements })
      .from(planograms)
      .leftJoin(planogramVersions, and(eq(planogramVersions.planogramId, planograms.id), eq(planogramVersions.number, planograms.publishedVersion)))
      .where(eq(planograms.storeId, storeId)),
    ...adjustmentQueries(storeId),
  ] as const);
  return Object.fromEntries(
    rows.map((r) => {
      const latest = r.number === null ? null : { number: r.number, placements: parseSnapshot(r.placements) };
      // Only the published adjustment is on the floor; a draft one is not.
      const published = adjustmentsOf(r.id, adjustmentRows, changeRows).published;
      return [r.fixtureId, { hasDraft: r.hasDraft, dueDate: r.dueDate, latest: latest && { ...latest, placements: adjustedFloor(latest, published?.changes ?? null) } }];
    }),
  );
}
