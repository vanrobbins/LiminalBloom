// What the Quick Adjust writes share (0.7.0.9 spec §6.3): the outcomes, the guard that pins a write to the
// published version, how a clash with another device reads, and the statement that ends open adjustments.
// Any guard raising rolls the whole batch back (write-core.ts). Nothing here bumps `planograms.version`.

import "server-only";

import { and, eq, inArray, sql, type SQLWrapper } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { planogramAdjustments, planograms } from "@/db/schema";
import { conflictLabel } from "@/lib/layout/save";
import { databaseError } from "@/lib/products/errors";
import { guarded } from "@/lib/products/write";

export type AdjustOutcome = { status: "saved" } | { status: "conflict" } | { status: "invalid"; message: string } | { status: "not-found" };
export type AdjustPublishOutcome =
  | { status: "saved" }
  | { status: "draft-changed" }
  | { status: "published-elsewhere"; number: number }
  | { status: "invalid"; message: string }
  | { status: "not-found" };

export const SAVED = { status: "saved" } as const;
export const CONFLICT = { status: "conflict" } as const;
export const NOT_FOUND = { status: "not-found" } as const;
export const invalid = (message: string) => ({ status: "invalid", message }) as const;

/** The planogram's published version is still `publishedVersion`, checked and held for the rest of the batch (the row lock
 *  makes a full publish wait, or fail this guard). It writes the row back as it is: `version` does not move. */
export const pinVersion = (storeId: string, planogramId: string, publishedVersion: number): BatchItem<"pg"> =>
  guarded(
    db
      .update(planograms)
      .set({ updatedAt: sql`${planograms.updatedAt}` })
      .where(and(eq(planograms.storeId, storeId), eq(planograms.id, planogramId), eq(planograms.publishedVersion, publishedVersion)))
      .returning({ id: planograms.id }),
    "planogram",
  );

/** A full publish ends every open adjustment of the planogram in its own batch. */
export const endOpenAdjustments = (storeId: string, planogramId: string) =>
  db
    .update(planogramAdjustments)
    .set({ state: "ended", endedReason: "new_version", endedAt: new Date(), version: sql`${planogramAdjustments.version} + 1`, updatedAt: new Date() })
    .where(and(eq(planogramAdjustments.storeId, storeId), eq(planogramAdjustments.planogramId, planogramId), inArray(planogramAdjustments.state, ["draft", "published"])));

/** `guarded` with one more statement run in the same one (a data-modifying CTE), so a batch keeps its statement count. */
export function guardedWith(query: SQLWrapper, label: string, also: SQLWrapper): BatchItem<"pg"> {
  return db.execute(sql`with changed as ${query}, also as ${also} select layout_assert((select count(*) from changed) = 1, ${label})`);
}

const CLASHES = ["planogram_adjustment_changes_target_unique", "planogram_adjustments_one_draft", "planogram_adjustments_one_published"];

/** Another device got there first (a guard raised, or a unique index refused). */
export function isAdjustClash(error: unknown): boolean {
  if (conflictLabel(error) !== null) return true;
  const failure = databaseError(error);
  return failure?.code === "23505" && CLASHES.includes(failure.constraint ?? "");
}

/** A product or face deleted between the read and the batch: the foreign key refuses it. */
export const isGone = (error: unknown): boolean => databaseError(error)?.code === "23503";

export async function attemptAdjust(run: () => Promise<AdjustOutcome>): Promise<AdjustOutcome> {
  try {
    return await run();
  } catch (error) {
    if (isAdjustClash(error)) return CONFLICT;
    if (isGone(error)) return invalid("A product in this Quick Adjust was deleted. Look again.");
    throw error;
  }
}
