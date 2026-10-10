// Draft writes (spec §4.2–4.5, §4.7). Each loads, checks in code with the
// editor's own rules, then writes one store-scoped batch guarded by
// layout_assert: the planogram's version (nothing saved between this check and
// this write) and, for an edit, the placement's version (the two-device rule).
// Any guard raising rolls the whole batch back.

import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { planogramPlacements, planograms } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { loadLayout } from "@/lib/layout/load";
import { conflictLabel } from "@/lib/layout/save";
import { databaseError } from "@/lib/products/errors";
import { guarded } from "@/lib/products/write";

import { planogramScope } from "./faces";
import { floorLocations, loadPlanogram, productFits, type PlanogramRow } from "./queries";
import { restoreRows, type RestoredRow } from "./restore";
import { checkPlacement } from "./rules";
import type { Change, PlacementFields, PlanogramScope } from "./types";

export type Statements = [BatchItem<"pg">, ...BatchItem<"pg">[]];
export type Outcome = { status: "saved" } | { status: "conflict" } | { status: "invalid"; message: string } | { status: "not-found" };

const SAVED = { status: "saved" } as const;
const CONFLICT = { status: "conflict" } as const;
const NOT_FOUND = { status: "not-found" } as const;

export async function scopeFor(storeId: string, fixtureId: string): Promise<PlanogramScope | null> {
  return planogramScope(await loadLayout(storeId), fixtureId);
}

/** Another device got there first; anything else is a real failure. */
export function isClash(error: unknown): boolean {
  if (conflictLabel(error) !== null) return true;
  const failure = databaseError(error);
  return (
    failure?.code === "23505" &&
    (failure.constraint === "planograms_fixture_unique" || failure.constraint === "planogram_versions_number_unique")
  );
}

async function attempt(run: () => Promise<Outcome>): Promise<Outcome> {
  try {
    return await run();
  } catch (error) {
    if (isClash(error)) return CONFLICT;
    throw error;
  }
}

export const bumped = () => ({ version: sql`${planograms.version} + 1`, updatedAt: new Date() });

export const planogramWhere = (storeId: string, id: string, version: number) =>
  and(eq(planograms.storeId, storeId), eq(planograms.id, id), eq(planograms.version, version));

const placementWhere = (storeId: string, row: PlanogramRow, id: string, version: number) =>
  and(
    eq(planogramPlacements.storeId, storeId),
    eq(planogramPlacements.planogramId, row.id),
    eq(planogramPlacements.id, id),
    eq(planogramPlacements.version, version),
  );

export function placementInserts(storeId: string, planogramId: string, rows: readonly RestoredRow[]): BatchItem<"pg">[] {
  return rows.length === 0
    ? []
    : [db.insert(planogramPlacements).values(rows.map((r) => ({ id: randomUUID(), storeId, planogramId, ...r })))];
}

export function startDraft(storeId: string, fixtureId: string, expectedVersion: number | null): Promise<Outcome> {
  return attempt(async () => {
    const scope = await scopeFor(storeId, fixtureId);
    if (!scope) return NOT_FOUND;
    const { row, latest } = await loadPlanogram(storeId, fixtureId);
    if ((row?.version ?? null) !== expectedVersion || row?.hasDraft) return CONFLICT;
    const rows = latest
      ? restoreRows(latest.placements, scope.faces, await productFits(storeId, latest.placements.map((p) => p.productId))).rows
      : await floorLocations(storeId, scope.faces.map((f) => f.faceId));
    const id = row?.id ?? randomUUID();
    // No row yet: two first starts both insert and the unique fixture index refuses one.
    const head: BatchItem<"pg"> = row
      ? guarded(
          db
            .update(planograms)
            .set({ hasDraft: true, basedOnVersion: row.publishedVersion, ...bumped() })
            .where(and(planogramWhere(storeId, row.id, row.version), eq(planograms.hasDraft, false)))
            .returning({ id: planograms.id }),
          "planogram",
        )
      : db.insert(planograms).values({ id, storeId, fixtureId, hasDraft: true });
    await withStore(storeId, [head, ...placementInserts(storeId, id, rows)]);
    return SAVED;
  });
}

/** Only the placement's own fields: never let them set the server's ids. */
const fieldValues = (f: PlacementFields): PlacementFields => ({
  faceId: f.faceId,
  presentation: f.presentation,
  col: f.col,
  row: f.row,
  colSpan: f.colSpan,
  rowSpan: f.rowSpan,
  pieceCount: f.pieceCount,
});

/** Exported so a test can build it from a stale read and prove the guard (as lib/layout/save.test.ts does). */
export function changeStatements(storeId: string, row: PlanogramRow, change: Change, productId: string): Statements {
  const head = guarded(
    db
      .update(planograms)
      .set(bumped())
      .where(and(planogramWhere(storeId, row.id, row.version), eq(planograms.hasDraft, true)))
      .returning({ id: planograms.id }),
    "planogram",
  );
  if (change.kind === "add") {
    return [head, db.insert(planogramPlacements).values({ ...fieldValues(change.fields), id: randomUUID(), storeId, planogramId: row.id, productId })];
  }
  const where = placementWhere(storeId, row, change.id, change.version);
  const write =
    change.kind === "remove"
      ? db.delete(planogramPlacements).where(where).returning({ id: planogramPlacements.id })
      : db
          .update(planogramPlacements)
          .set({ ...fieldValues(change.fields), version: sql`${planogramPlacements.version} + 1`, updatedAt: new Date() })
          .where(where)
          .returning({ id: planogramPlacements.id });
  return [head, guarded(write, "placement")];
}

export function saveChange(storeId: string, fixtureId: string, change: Change): Promise<Outcome> {
  return attempt(async () => {
    const scope = await scopeFor(storeId, fixtureId);
    const { row, draft } = await loadPlanogram(storeId, fixtureId);
    if (!scope || !row) return NOT_FOUND;
    if (!draft) return CONFLICT;
    const target = change.kind === "add" ? null : draft.placements.find((p) => p.id === change.id);
    if (change.kind !== "add" && !target) return CONFLICT;
    const productId = change.kind === "add" ? change.productId : (target?.productId ?? "");

    if (change.kind !== "remove") {
      const fit = (await productFits(storeId, [productId])).get(productId);
      if (!fit) return { status: "invalid", message: "That product is no longer in the library." };
      const stackLimit = fit.footprints[change.fields.presentation].stackLimit;
      const refusal = checkPlacement({ ...change.fields, id: target?.id ?? null }, draft.placements, scope.faces, stackLimit);
      if (refusal) return { status: "invalid", message: refusal.message };
    }
    await withStore(storeId, changeStatements(storeId, row, change, productId));
    return SAVED;
  });
}

export function discardDraft(storeId: string, fixtureId: string, expectedVersion: number): Promise<Outcome> {
  return attempt(async () => {
    const { row } = await loadPlanogram(storeId, fixtureId);
    if (!row) return NOT_FOUND;
    await withStore(storeId, [
      db.delete(planogramPlacements).where(and(eq(planogramPlacements.storeId, storeId), eq(planogramPlacements.planogramId, row.id))),
      guarded(
        db
          .update(planograms)
          .set({ hasDraft: false, basedOnVersion: null, ...bumped() })
          .where(and(planogramWhere(storeId, row.id, expectedVersion), eq(planograms.hasDraft, true)))
          .returning({ id: planograms.id }),
        "planogram",
      ),
    ]);
    return SAVED;
  });
}

// The due date is one last-write-wins field, unrelated to placements: no version
// bump or check, so it never refuses or disturbs a draft edit. Two first uses
// both insert and the unique fixture index refuses one.
export function setDueDate(storeId: string, fixtureId: string, dueDate: string | null): Promise<Outcome> {
  return attempt(async () => {
    if (!(await scopeFor(storeId, fixtureId))) return NOT_FOUND;
    const { row } = await loadPlanogram(storeId, fixtureId);
    await withStore(storeId, [
      row
        ? guarded(
            db
              .update(planograms)
              .set({ dueDate, updatedAt: new Date() })
              .where(and(eq(planograms.storeId, storeId), eq(planograms.id, row.id)))
              .returning({ id: planograms.id }),
            "planogram",
          )
        : db.insert(planograms).values({ id: randomUUID(), storeId, fixtureId, dueDate }),
    ]);
    return SAVED;
  });
}
