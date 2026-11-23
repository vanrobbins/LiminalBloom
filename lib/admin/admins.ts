// Liminal Bloom's own admins (spec 0.7.1 7.1): list, add by email (the account must exist; they set up
// two-step sign-in on their first visit) and remove (never the last). Each change is ONE statement with its
// `platform_events` row (lib/admin/events.ts). Runs as the table owner; the action has already awaited
// requirePlatformAdminForAction. An admin's two-factor reset is the script's alone, not here (spec 7.1).

import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";

import { type AdminActor, platformEventFrom } from "./events";

type Row = Record<string, unknown>;

export type AdminRow = { userId: string; name: string; email: string; addedByName: string; createdAt: Date };

/** Every admin, oldest first. */
export async function listAdmins(): Promise<AdminRow[]> {
  return db
    .select({ userId: platformAdmins.userId, name: user.name, email: user.email, addedByName: platformAdmins.addedByName, createdAt: platformAdmins.createdAt })
    .from(platformAdmins)
    .innerJoin(user, eq(user.id, platformAdmins.userId))
    .orderBy(asc(platformAdmins.createdAt), asc(user.email));
}

export type AddOutcome = { status: "done"; userId: string; email: string } | { status: "no-account" | "already" };

/** Makes the account with this email an admin. */
export async function addAdmin(actor: AdminActor, rawEmail: string, reason: string): Promise<AddOutcome> {
  const email = rawEmail.trim().toLowerCase();
  const { rows } = await db.execute<Row>(sql`
    with target as (select id, email from "user" where email = ${email}),
    changed as (
      insert into platform_admins (user_id, added_by, added_by_name)
      select id, ${actor.userId}::text, ${actor.name}::text from target
      on conflict (user_id) do nothing returning user_id),
    logged as (${platformEventFrom(actor, { action: "admin_added", targetKind: "admin", targetId: sql`t.id`, targetLabel: sql`t.email`, reason }, sql`target t join changed c on c.user_id = t.id`)})
    select (select count(*) from target)::int as found, (select user_id from changed) as added`);
  const row = rows[0];
  if (row?.added) return { status: "done", userId: String(row.added), email };
  return { status: Number(row?.found) === 0 ? "no-account" : "already" };
}

export type RemoveOutcome = { status: "done"; email: string } | { status: "gone" | "last" };

/**
 * Removes an admin, but never the last. The delete first locks the admin rows (`for update`, in id order)
 * and counts what the lock saw, so two admins removing each other at once queue and the second finds one
 * left (a row the first deleted is skipped by the lock), as lib/passkeys/change.ts does for passkeys.
 * `counted` narrows which rows count as admins; it is for tests that share the table with real admins, and
 * production always passes null (every admin counts).
 */
export async function removeAdminAmong(actor: AdminActor, userId: string, reason: string, counted: string[] | null): Promise<RemoveOutcome> {
  const scope = counted === null ? sql`true` : sql`user_id in (${sql.join(counted.map((id) => sql`${id}::text`), sql`, `)})`;
  const { rows } = await db.execute<Row>(sql`
    with mine as (select user_id from platform_admins where ${scope} order by user_id for update),
    changed as (
      delete from platform_admins where user_id = ${userId} and (select count(*) from mine) > 1
      returning user_id),
    logged as (${platformEventFrom(actor, { action: "admin_removed", targetKind: "admin", targetId: sql`u.id`, targetLabel: sql`u.email`, reason }, sql`"user" u join changed c on c.user_id = u.id`)})
    select (select email from "user" where id in (select user_id from changed)) as email`);
  if (rows[0]?.email) return { status: "done", email: String(rows[0].email) };
  const [still] = await db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId));
  return { status: still ? "last" : "gone" };
}

export const removeAdmin = (actor: AdminActor, userId: string, reason: string) => removeAdminAmong(actor, userId, reason, null);
