// What draft writes (write.ts) and publish/restore (publish.ts) share: the
// outcomes, how a clash with another device reads, and the planogram's version
// guard. Any guard raising rolls the whole batch back.

import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { planogramPlacements, planograms } from "@/db/schema";
import { loadLayout } from "@/lib/layout/load";
import { conflictLabel } from "@/lib/layout/save";
import { databaseError } from "@/lib/products/errors";

import { planogramScope } from "./faces";
import type { RestoredRow } from "./restore";
import type { PlanogramScope } from "./types";

export type Statements = [BatchItem<"pg">, ...BatchItem<"pg">[]];
export type Outcome = { status: "saved"; switchedToHung?: true } | { status: "conflict" } | { status: "invalid"; message: string } | { status: "not-found" };

export const SAVED = { status: "saved" } as const;
export const CONFLICT = { status: "conflict" } as const;
export const NOT_FOUND = { status: "not-found" } as const;

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

export async function attempt(run: () => Promise<Outcome>): Promise<Outcome> {
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

export function placementInserts(storeId: string, planogramId: string, rows: readonly RestoredRow[]): BatchItem<"pg">[] {
  return rows.length === 0
    ? []
    : [db.insert(planogramPlacements).values(rows.map((r) => ({ id: randomUUID(), storeId, planogramId, ...r })))];
}
