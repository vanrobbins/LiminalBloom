// Publishing and restoring (spec §4.4, §4.6). A publish is one batch: guard,
// insert the version, rewrite this planogram's floor product_locations, drop
// the draft. Search reads product_locations, so it sees the new floor at once.

import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { planogramPlacements, planograms, planogramVersions, productLocations } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { databaseError } from "@/lib/products/errors";
import { guarded } from "@/lib/products/write";

import { comparableDraft, diffPlacements, sortByFaceOrder, type FaceChanges } from "./diff";
import { loadPlanogram, loadVersion, productFits, type PlanogramRow } from "./queries";
import { restoreRows, type Skipped } from "./restore";
import { draftIssues } from "./rules";
import { buildSnapshot } from "./snapshot";
import type { DraftState, PlanogramScope } from "./types";
import { bumped, isClash, placementInserts, planogramWhere, scopeFor, type Statements } from "./write";

export type Preview = {
  planogramVersion: number;
  basedOnVersion: number | null;
  nextNumber: number;
  changes: FaceChanges[];
  issues: { id: string; productName: string; message: string }[];
  isEmpty: boolean;
};
export type Publisher = { id: string | null; name: string };
export type PublishOutcome =
  | { status: "saved"; number: number }
  | { status: "draft-changed" }
  | { status: "published-elsewhere"; number: number }
  | { status: "invalid"; message: string }
  | { status: "not-found" };
export type RestoreOutcome = { status: "saved"; skipped: Skipped } | { status: "conflict" } | { status: "not-found" };

export async function previewPublish(storeId: string, fixtureId: string): Promise<Preview | null> {
  const scope = await scopeFor(storeId, fixtureId);
  const { row, draft, latest } = await loadPlanogram(storeId, fixtureId);
  if (!scope || !row || !draft) return null;
  const issues = draftIssues(draft.placements, scope.faces);
  return {
    planogramVersion: row.version,
    basedOnVersion: row.basedOnVersion,
    nextNumber: (row.publishedVersion ?? 0) + 1,
    // Faces in the planogram's own order (upper table first), not the draft's row/column order.
    changes: sortByFaceOrder(diffPlacements(latest?.placements ?? [], comparableDraft(draft.placements, scope.faces)), scope.faces.map((f) => f.faceId)),
    issues: draft.placements.flatMap((p) => {
      const message = issues.get(p.id);
      return message ? [{ id: p.id, productName: p.productName, message }] : [];
    }),
    isEmpty: draft.placements.length === 0,
  };
}

/** Exported so a test can build it from a stale read and prove the guard. */
export function publishStatements(
  storeId: string,
  scope: PlanogramScope,
  row: PlanogramRow,
  draft: DraftState,
  summary: string | null,
  publisher: Publisher,
): Statements {
  const number = (row.publishedVersion ?? 0) + 1;
  const faceIds = scope.faces.map((f) => f.faceId);
  const floor: BatchItem<"pg">[] = draft.placements.length
    ? [
        db.insert(productLocations).values(
          draft.placements.map((p) => ({
            storeId,
            productId: p.productId,
            presentation: p.presentation,
            faceId: p.faceId,
            col: p.col,
            row: p.row,
            colSpan: p.colSpan,
            rowSpan: p.rowSpan,
          })),
        ),
      ]
    : [];
  return [
    guarded(
      db
        .update(planograms)
        .set({ publishedVersion: number, hasDraft: false, basedOnVersion: null, ...bumped() })
        .where(
          and(
            planogramWhere(storeId, row.id, row.version),
            eq(planograms.hasDraft, true),
            // Belt and braces: every publish also bumps version, so the version guard alone refuses this case.
            sql`${planograms.publishedVersion} is not distinct from ${planograms.basedOnVersion}`,
          ),
        )
        .returning({ id: planograms.id }),
      "planogram",
    ),
    db.insert(planogramVersions).values({
      storeId,
      planogramId: row.id,
      number,
      publishedBy: publisher.id,
      publishedByName: publisher.name,
      summary,
      placements: buildSnapshot(draft.placements, scope.faces),
    }),
    // Only this planogram's faces: other fixtures and stockroom bins are never touched.
    db.delete(productLocations).where(and(eq(productLocations.storeId, storeId), inArray(productLocations.faceId, faceIds))),
    ...floor,
    db.delete(planogramPlacements).where(and(eq(planogramPlacements.storeId, storeId), eq(planogramPlacements.planogramId, row.id))),
  ];
}

function refusal(current: PlanogramRow, basedOnVersion: number | null): PublishOutcome {
  return current.publishedVersion !== null && current.publishedVersion !== basedOnVersion
    ? { status: "published-elsewhere", number: current.publishedVersion }
    : { status: "draft-changed" };
}

export async function publishDraft(
  storeId: string,
  fixtureId: string,
  expectedVersion: number,
  basedOnVersion: number | null,
  summary: string | null,
  publisher: Publisher,
): Promise<PublishOutcome> {
  const scope = await scopeFor(storeId, fixtureId);
  const { row, draft } = await loadPlanogram(storeId, fixtureId);
  if (!scope || !row) return { status: "not-found" };
  if (!draft || row.version !== expectedVersion) return refusal(row, basedOnVersion);
  if (draftIssues(draft.placements, scope.faces).size > 0) {
    return { status: "invalid", message: "Fix the marked placements before publishing." };
  }
  try {
    await withStore(storeId, publishStatements(storeId, scope, row, draft, summary, publisher));
    return { status: "saved", number: (row.publishedVersion ?? 0) + 1 };
  } catch (error) {
    // A product or face deleted between the load and the batch: the draft changed under us.
    if (databaseError(error)?.code === "23503") return { status: "draft-changed" };
    if (!isClash(error)) throw error;
    const now = (await loadPlanogram(storeId, fixtureId)).row;
    return now ? refusal(now, basedOnVersion) : { status: "not-found" };
  }
}

export async function restoreVersion(storeId: string, fixtureId: string, expectedVersion: number, number: number): Promise<RestoreOutcome> {
  const scope = await scopeFor(storeId, fixtureId);
  const { row } = await loadPlanogram(storeId, fixtureId);
  if (!scope || !row) return { status: "not-found" };
  if (row.version !== expectedVersion) return { status: "conflict" };
  const version = await loadVersion(storeId, row.id, number);
  if (!version) return { status: "not-found" };
  const { rows, skipped } = restoreRows(version.placements, scope.faces, await productFits(storeId, version.placements.map((p) => p.productId)));
  try {
    await withStore(storeId, [
      db.delete(planogramPlacements).where(and(eq(planogramPlacements.storeId, storeId), eq(planogramPlacements.planogramId, row.id))),
      guarded(
        db
          .update(planograms)
          .set({ hasDraft: true, basedOnVersion: sql`${planograms.publishedVersion}`, ...bumped() })
          .where(planogramWhere(storeId, row.id, expectedVersion))
          .returning({ id: planograms.id }),
        "planogram",
      ),
      ...placementInserts(storeId, row.id, rows),
    ]);
  } catch (error) {
    if (isClash(error)) return { status: "conflict" };
    throw error;
  }
  return { status: "saved", skipped };
}
