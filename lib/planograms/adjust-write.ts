// Quick Adjust draft writes (0.7.0.9 spec §6.3). Each loads, checks in code with the placement rules, then writes
// one store-scoped batch guarded by layout_assert: the planogram's published version is pinned (a full publish waits
// or fails the guard), the draft must still be a draft, and a change is written under its own row's version, so only
// another device's change to the same tile conflicts. None of it bumps `planograms.version`.

import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { planogramAdjustmentChanges as changes, planogramAdjustments as adjustments } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { guarded } from "@/lib/products/write";

import { applyAdjustment, targetKey, type AdjustmentState, type ChangeRow, type TargetRef } from "./adjust";
import { attemptAdjust, CONFLICT, invalid, isAdjustClash, NOT_FOUND, pinVersion, SAVED, type AdjustOutcome } from "./adjust-core";
import { loadAdjustments, loadCandidates } from "./adjust-queries";
import { fitProblem, othersOf } from "./adjust-suggest";
import { loadPlanogram } from "./queries";
import type { PlanogramFace, SnapshotEntry } from "./types";
import { scopeFor, type Statements } from "./write-core";

export type Choice = { kind: "keep" } | { kind: "empty" } | { kind: "replace"; productId: string };
/** What goes in the change row: a replacement carries its footprint. */
export type ChangeWrite = { kind: "keep" } | { kind: "empty" } | { kind: "replace"; productId: string; colSpan: number; rowSpan: number };
export type OpenOutcome = { status: "saved"; draft: AdjustmentState } | { status: "conflict" } | { status: "not-found" };

/** The published adjustment's changes, copied in SQL so a draft always starts from what is on the floor. */
const copyPublishedChanges = (storeId: string, planogramId: string, draftId: string): BatchItem<"pg"> =>
  db.execute(sql`
    insert into planogram_adjustment_changes (store_id, adjustment_id, kind, face_id, target_product_id, presentation, col, row, col_span, row_span, depth,
      replacement_product_id, replacement_col_span, replacement_row_span, piece_count)
    select c.store_id, ${draftId}::uuid, c.kind, c.face_id, c.target_product_id, c.presentation, c.col, c.row, c.col_span, c.row_span, c.depth,
      c.replacement_product_id, c.replacement_col_span, c.replacement_row_span, c.piece_count
    from planogram_adjustment_changes c
    join planogram_adjustments a on a.store_id = c.store_id and a.id = c.adjustment_id
    where a.store_id = ${storeId} and a.planogram_id = ${planogramId}::uuid and a.state = 'published'`);

/**
 * The draft for this planogram: the one under way, else a new one pinned to the published version that copies the published
 * adjustment's changes. A second device opening at the same moment hits the one-draft index and adopts the winner's.
 */
export async function openAdjustment(storeId: string, fixtureId: string, creatorName: string): Promise<OpenOutcome> {
  const { row } = await loadPlanogram(storeId, fixtureId);
  if (!row || row.publishedVersion === null) return NOT_FOUND;
  const existing = (await loadAdjustments(storeId, row.id)).draft;
  if (existing) return { status: "saved", draft: existing };
  const id = randomUUID();
  try {
    await withStore(storeId, [
      pinVersion(storeId, row.id, row.publishedVersion),
      db.insert(adjustments).values({ id, storeId, planogramId: row.id, basedOnVersion: row.publishedVersion, createdByName: creatorName }),
      copyPublishedChanges(storeId, row.id, id),
    ]);
  } catch (error) {
    if (!isAdjustClash(error)) throw error;
  }
  const draft = (await loadAdjustments(storeId, row.id)).draft;
  return draft ? { status: "saved", draft } : CONFLICT;
}

/** Exported so a test can build it from a stale read and prove the guards. */
export function changeStatements(
  storeId: string,
  draft: Pick<AdjustmentState, "id" | "planogramId" | "basedOnVersion">,
  entry: SnapshotEntry,
  existing: ChangeRow | undefined,
  write: ChangeWrite,
  expectedVersion: number | null,
): Statements {
  const values = {
    kind: write.kind === "replace" ? ("replace" as const) : ("empty" as const),
    replacementProductId: write.kind === "replace" ? write.productId : null,
    replacementColSpan: write.kind === "replace" ? write.colSpan : null,
    replacementRowSpan: write.kind === "replace" ? write.rowSpan : null,
  };
  const own = and(eq(changes.storeId, storeId), eq(changes.adjustmentId, draft.id), eq(changes.id, existing?.id ?? ""), eq(changes.version, expectedVersion ?? 0));
  const tail: BatchItem<"pg"> = !existing
    ? db.insert(changes).values({
        ...values,
        storeId,
        adjustmentId: draft.id,
        faceId: entry.faceId,
        targetProductId: entry.productId,
        presentation: entry.presentation,
        col: entry.col,
        row: entry.row,
        colSpan: entry.colSpan,
        rowSpan: entry.rowSpan,
        depth: entry.depth ?? 0,
        pieceCount: entry.pieceCount,
      })
    : write.kind === "keep"
      ? guarded(db.delete(changes).where(own).returning({ id: changes.id }), "change")
      : guarded(db.update(changes).set({ ...values, version: sql`${changes.version} + 1`, updatedAt: new Date() }).where(own).returning({ id: changes.id }), "change");
  return [
    pinVersion(storeId, draft.planogramId, draft.basedOnVersion),
    // Every change moves the draft's version, so a publish that read the draft before it is refused.
    guarded(
      db
        .update(adjustments)
        .set({ version: sql`${adjustments.version} + 1`, updatedAt: new Date() })
        .where(and(eq(adjustments.storeId, storeId), eq(adjustments.id, draft.id), eq(adjustments.state, "draft")))
        .returning({ id: adjustments.id }),
      "adjustment",
    ),
    tail,
  ];
}

/** The replacement as a change row, or why it can't go there. `floor` is the adjusted floor without this tile's own change. */
async function replacementFor(storeId: string, entry: SnapshotEntry, floor: readonly SnapshotEntry[], faces: readonly PlanogramFace[], productId: string): Promise<ChangeWrite | string> {
  const [product] = await loadCandidates(storeId, { ids: [productId] });
  if (!product) return "That product is no longer in the library.";
  if (product.status === "sold_out") return `${product.name} is sold out.`;
  const { columns: colSpan, rows: rowSpan } = product.footprints[entry.presentation];
  const problem = fitProblem(entry, colSpan, rowSpan, othersOf(floor, entry), faces);
  return problem ? `${product.name} doesn't fit there: ${problem}.` : { kind: "replace", productId: product.id, colSpan, rowSpan };
}

export function setChange(storeId: string, fixtureId: string, adjustmentId: string, ref: TargetRef, choice: Choice, expectedVersion: number | null): Promise<AdjustOutcome> {
  return attemptAdjust(async () => {
    const scope = await scopeFor(storeId, fixtureId);
    const { row, latest } = await loadPlanogram(storeId, fixtureId);
    if (!scope || !row || !latest || row.publishedVersion === null) return NOT_FOUND;
    const draft = (await loadAdjustments(storeId, row.id)).draft;
    if (!draft || draft.id !== adjustmentId || draft.basedOnVersion !== row.publishedVersion) return CONFLICT;
    const key = targetKey(ref);
    const entry = latest.placements.find((e) => targetKey(e) === key);
    if (!entry) return invalid("That tile is no longer in this version.");
    const existing = draft.changes.find((c) => targetKey(c.target) === key);
    if ((existing?.version ?? null) !== expectedVersion) return CONFLICT;
    if (choice.kind === "keep" && !existing) return SAVED;

    const floor = applyAdjustment(latest.placements, draft.changes.filter((c) => c !== existing)).entries;
    const write = choice.kind === "replace" ? await replacementFor(storeId, entry, floor, scope.faces, choice.productId) : choice;
    if (typeof write === "string") return invalid(write);
    await withStore(storeId, changeStatements(storeId, draft, entry, existing, write, expectedVersion));
    return SAVED;
  });
}

export function discardAdjustment(storeId: string, fixtureId: string, adjustmentId: string, expectedVersion: number): Promise<AdjustOutcome> {
  return attemptAdjust(async () => {
    const { row } = await loadPlanogram(storeId, fixtureId);
    if (!row) return NOT_FOUND;
    await withStore(storeId, [
      guarded(
        db
          .delete(adjustments)
          .where(and(eq(adjustments.storeId, storeId), eq(adjustments.id, adjustmentId), eq(adjustments.planogramId, row.id), eq(adjustments.state, "draft"), eq(adjustments.version, expectedVersion)))
          .returning({ id: adjustments.id }),
        "adjustment",
      ),
    ]);
    return SAVED;
  });
}
