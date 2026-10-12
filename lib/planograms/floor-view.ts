// Every published planogram in a store at once, for the map (spec §5): the
// map shows what is on the floor, so only the latest version, plus whether a
// draft is in progress and when it is due. One store-scoped query.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { planograms, planogramVersions } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";

import { parseSnapshot } from "./snapshot";
import type { FloorPlanogram } from "./types";

export type { FloorPlanogram };

export async function floorPlanograms(storeId: string): Promise<Record<string, FloorPlanogram>> {
  const [rows] = await withStore(storeId, [
    db
      .select({ fixtureId: planograms.fixtureId, hasDraft: planograms.hasDraft, dueDate: planograms.dueDate, number: planogramVersions.number, placements: planogramVersions.placements })
      .from(planograms)
      .leftJoin(planogramVersions, and(eq(planogramVersions.planogramId, planograms.id), eq(planogramVersions.number, planograms.publishedVersion)))
      .where(eq(planograms.storeId, storeId)),
  ] as const);
  return Object.fromEntries(
    rows.map((r) => [r.fixtureId, { hasDraft: r.hasDraft, dueDate: r.dueDate, latest: r.number === null ? null : { number: r.number, placements: parseSnapshot(r.placements) } }]),
  );
}
