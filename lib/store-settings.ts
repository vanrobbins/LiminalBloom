// A store's time zone (DECISIONS "Time", 10-12): read by every screen that
// says "today", changed only by the store's Better Auth owner or admin (the
// people who administer a store, DECISIONS 09-28; Week 7 swaps in the Admin
// role). Reads and writes go through withStore like every store table.

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { storeSettings } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { conflictLabel } from "@/lib/layout/save";
import { guarded } from "@/lib/products/write";
import { DEFAULT_TIMEZONE, isTimezone } from "@/lib/time/zones";

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

export async function canManageStore(userId: string, storeId: string): Promise<boolean> {
  const rows = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, storeId)));
  // Better Auth may store several roles, comma-separated.
  return rows.some((r) => r.role.split(",").some((role) => ["owner", "admin"].includes(role.trim())));
}

export async function setStoreTimezone(storeId: string, userId: string, timezone: string, expectedVersion: number): Promise<SettingsOutcome> {
  if (!isTimezone(timezone)) return { status: "invalid" };
  if (!(await canManageStore(userId, storeId))) return { status: "forbidden" };
  try {
    await withStore(storeId, [
      guarded(
        db
          .update(storeSettings)
          .set({ timezone, version: sql`${storeSettings.version} + 1`, updatedAt: new Date() })
          .where(and(eq(storeSettings.storeId, storeId), eq(storeSettings.version, expectedVersion)))
          .returning({ storeId: storeSettings.storeId }),
        "store settings",
      ),
    ]);
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
