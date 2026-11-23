// Publishing and reverting a Quick Adjust (0.7.0.9 spec §6.3). Each is one batch: pin the planogram's published
// version, guard the adjustment, rewrite this planogram's floor with the same builder a full publish uses.
// Neither bumps `planograms.version` (a monthly draft open elsewhere keeps saving) and neither writes a version.

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { planogramAdjustments as adjustments } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { guarded } from "@/lib/products/write";

import { applyAdjustment, type AdjustmentState } from "./adjust";
import { attemptAdjust, CONFLICT, isAdjustClash, isGone, NOT_FOUND, pinVersion, SAVED, type AdjustOutcome, type AdjustPublishOutcome } from "./adjust-core";
import { loadAdjustments } from "./adjust-queries";
import { fitProblem, othersOf } from "./adjust-suggest";
import { productFits } from "./draft-sources";
import { floorStatements } from "./floor-rows";
import type { Publisher } from "./publish";
import { loadPlanogram, type PlanogramRow } from "./queries";
import type { PlanogramScope, SnapshotEntry } from "./types";
import { scopeFor, type Statements } from "./write-core";

/** The entries that can go on the floor now: on this planogram's faces, of products still in the library. */
async function onTheFloor(storeId: string, scope: PlanogramScope, entries: readonly SnapshotEntry[]): Promise<SnapshotEntry[]> {
  const fits = await productFits(storeId, entries.map((e) => e.productId));
  return entries.filter((e) => fits.has(e.productId) && scope.faces.some((f) => f.faceId === e.faceId));
}

const ended = (reason: "reverted" | "superseded") => ({ state: "ended" as const, endedReason: reason, endedAt: new Date(), version: sql`${adjustments.version} + 1`, updatedAt: new Date() });

/** Exported so a test can build it from a stale read and prove the guards (as publish.test.ts does for a full publish). */
export function publishAdjustmentStatements(
  storeId: string,
  scope: PlanogramScope,
  row: PlanogramRow,
  draft: AdjustmentState,
  floor: readonly SnapshotEntry[],
  publisher: Publisher,
): Statements {
  return [
    pinVersion(storeId, row.id, draft.basedOnVersion),
    // The one-published index allows a single row, so the old one ends first; a failed guard below rolls this back with the rest.
    db.update(adjustments).set(ended("superseded")).where(and(eq(adjustments.storeId, storeId), eq(adjustments.planogramId, row.id), eq(adjustments.state, "published"))),
    guarded(
      db
        .update(adjustments)
        .set({ state: "published", publishedAt: new Date(), publishedBy: publisher.id, publishedByName: publisher.name, version: sql`${adjustments.version} + 1`, updatedAt: new Date() })
        .where(and(eq(adjustments.storeId, storeId), eq(adjustments.id, draft.id), eq(adjustments.state, "draft"), eq(adjustments.version, draft.version)))
        .returning({ id: adjustments.id }),
      "adjustment",
    ),
    ...floorStatements(storeId, scope.faces.map((f) => f.faceId), floor),
  ];
}

export async function publishAdjustment(storeId: string, fixtureId: string, adjustmentId: string, expectedVersion: number, publisher: Publisher): Promise<AdjustPublishOutcome> {
  const scope = await scopeFor(storeId, fixtureId);
  const { row, latest } = await loadPlanogram(storeId, fixtureId);
  if (!scope || !row || !latest || row.publishedVersion === null) return NOT_FOUND;
  const { draft } = await loadAdjustments(storeId, row.id);
  const moved: AdjustPublishOutcome = { status: "published-elsewhere", number: row.publishedVersion };
  if (!draft || draft.id !== adjustmentId) {
    // Gone: a full publish ended it (the version moved), or it was discarded or published.
    const [wanted] = await db.select({ basedOnVersion: adjustments.basedOnVersion }).from(adjustments).where(and(eq(adjustments.storeId, storeId), eq(adjustments.id, adjustmentId), eq(adjustments.planogramId, row.id)));
    return wanted && wanted.basedOnVersion !== row.publishedVersion ? moved : { status: "draft-changed" };
  }
  if (draft.basedOnVersion !== row.publishedVersion) return moved;
  if (draft.version !== expectedVersion) return { status: "draft-changed" };
  if (draft.changes.length === 0) return { status: "invalid", message: "Choose a replacement or leave a tile empty first." };

  const { entries, skipped } = applyAdjustment(latest.placements, draft.changes);
  if (skipped > 0) return { status: "draft-changed" };
  // Each replacement still has to fit the floor around it (a footprint or a neighbour may have changed since it was chosen).
  const misfit = draft.changes.flatMap((c) => {
    if (c.kind !== "replace") return [];
    const placed = entries.find((e) => e.productId === c.replacement.productId && e.faceId === c.target.faceId && e.col === c.target.col && e.row === c.target.row && (e.depth ?? 0) === (c.target.depth ?? 0));
    return placed && fitProblem(placed, placed.colSpan, placed.rowSpan, othersOf(entries, placed), scope.faces) ? [c.replacement.productName] : [];
  });
  if (misfit.length > 0) return { status: "invalid", message: `${misfit.join(", ")} no longer fits. Look again before publishing.` };

  try {
    await withStore(storeId, publishAdjustmentStatements(storeId, scope, row, draft, await onTheFloor(storeId, scope, entries), publisher));
    return { status: "saved" };
  } catch (error) {
    if (isGone(error)) return { status: "draft-changed" };
    if (!isAdjustClash(error)) throw error;
    // The pin failing is a full publish landing first; the adjustment's own guard, another device's change or publish.
    const now = (await loadPlanogram(storeId, fixtureId)).row;
    return now?.publishedVersion != null && now.publishedVersion !== row.publishedVersion ? { status: "published-elsewhere", number: now.publishedVersion } : { status: "draft-changed" };
  }
}

/** Ends the published adjustment and puts the version's own floor back. */
export function revertAdjustment(storeId: string, fixtureId: string, adjustmentId: string): Promise<AdjustOutcome> {
  return attemptAdjust(async () => {
    const scope = await scopeFor(storeId, fixtureId);
    const { row, latest } = await loadPlanogram(storeId, fixtureId);
    if (!scope || !row || !latest || row.publishedVersion === null) return NOT_FOUND;
    const { published } = await loadAdjustments(storeId, row.id);
    if (!published || published.id !== adjustmentId) return CONFLICT;
    await withStore(storeId, [
      pinVersion(storeId, row.id, row.publishedVersion),
      guarded(
        db
          .update(adjustments)
          .set(ended("reverted"))
          .where(and(eq(adjustments.storeId, storeId), eq(adjustments.id, adjustmentId), eq(adjustments.state, "published")))
          .returning({ id: adjustments.id }),
        "adjustment",
      ),
      ...floorStatements(storeId, scope.faces.map((f) => f.faceId), await onTheFloor(storeId, scope, latest.placements)),
    ]);
    return SAVED;
  });
}
