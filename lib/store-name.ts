// Renaming a store (0.7.0 task 11, DECISIONS 11-02): the store is Better Auth's
// `organization` row. Better Auth's own /organization/update is closed to the
// browser (lib/auth.ts) because its check knows only owner / admin, so the rename
// is the app's own write, behind the store.settings switch the action checked.
//
// ONE statement changes the name and inserts its access_events row from RETURNING,
// so neither exists without the other. It is pinned to the name the person saw: a
// rename made elsewhere meanwhile changes nothing and answers "stale". Runs as the
// table owner (the store role cannot reach Better Auth's tables), so the store id
// is filtered by hand; the actor comes from the action's guard, never the browser.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { cleanStoreName } from "./store-name-limits";

export type RenameOutcome = { status: "renamed" | "stale" | "invalid" | "unchanged" };

export type RenameActor = { userId: string; name: string };

export async function renameStore(storeId: string, actor: RenameActor, seenName: string, rawName: string): Promise<RenameOutcome> {
  const name = cleanStoreName(rawName);
  if (name === null) return { status: "invalid" };
  if (name === seenName) return { status: "unchanged" };
  const done = await db.execute(sql`
    with renamed as (
      update organization o set name = ${name}
      from organization old
      where o.id = ${storeId} and old.id = o.id and o.name = ${seenName}
      returning old.name as old_name, o.name as new_name),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, 'store_renamed', jsonb_build_object('from', r.old_name, 'to', r.new_name) from renamed r returning id)
    select id from logged`);
  return { status: done.rows.length === 1 ? "renamed" : "stale" };
}
