// A store's time zone (DECISIONS "Time", 10-12): read by every screen that
// says "today", changed only by a person whose role holds the store.settings
// switch (spec 0.7, 4.1). Reads and writes go through withStore like every
// store table.

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { resolveAccess } from "@/lib/access/resolve";
import { withStore } from "@/lib/db/with-store";
import { conflictLabel } from "@/lib/layout/save";
import { guarded } from "@/lib/products/write";
import { canonicalZone, DEFAULT_TIMEZONE, isTimezone } from "@/lib/time/zones";

export type SettingsOutcome = { status: "saved" | "conflict" | "forbidden" | "invalid" };

export async function storeSettingsFor(storeId: string): Promise<{ timezone: string; version: number } | null> {
  const [rows] = await withStore(storeId, [
    db.select({ timezone: storeSettings.timezone, version: storeSettings.version }).from(storeSettings).where(eq(storeSettings.storeId, storeId)),
  ] as const);
  return rows[0] ?? null;
}

export async function storeTimezone(storeId: string): Promise<string> {
  const zone = (await storeSettingsFor(storeId))?.timezone;
  return zone && isTimezone(zone) ? zone : DEFAULT_TIMEZONE;
}

// Reads the database for the given person and store, never a caller's word for it
// (create-store calls this straight after making a store). resolveAccess falls back
// to the person's own store when they do not belong to the one asked for, so the
// store it settled on must be the one asked for.
async function mayChangeSettings(userId: string, storeId: string): Promise<boolean> {
  const access = await resolveAccess(userId, { activeStoreId: storeId });
  return access.activeStoreId === storeId && access.switches.has("store.settings");
}

/** expectedVersion 0 means "this store has no settings row yet": the row is made, unless one appeared meanwhile. */
export async function setStoreTimezone(storeId: string, userId: string, input: string, expectedVersion: number): Promise<SettingsOutcome> {
  const timezone = canonicalZone(input);
  if (timezone === null) return { status: "invalid" };
  if (!(await mayChangeSettings(userId, storeId))) return { status: "forbidden" };
  const write =
    expectedVersion === 0
      ? db.insert(storeSettings).values({ storeId, timezone }).onConflictDoNothing().returning({ storeId: storeSettings.storeId })
      : db
          .update(storeSettings)
          .set({ timezone, version: sql`${storeSettings.version} + 1`, updatedAt: new Date() })
          .where(and(eq(storeSettings.storeId, storeId), eq(storeSettings.version, expectedVersion)))
          .returning({ storeId: storeSettings.storeId });
  try {
    await withStore(storeId, [guarded(write, "store settings")]);
    return { status: "saved" };
  } catch (error) {
    if (conflictLabel(error) !== null) return { status: "conflict" };
    throw error;
  }
}

/** Every new store gets a time zone the moment it exists (the creation hook, lib/auth.ts). */
export async function giveStoreSettings(storeId: string): Promise<void> {
  await db.insert(storeSettings).values({ storeId, timezone: DEFAULT_TIMEZONE }).onConflictDoNothing();
}
