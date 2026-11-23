// Pause and Restore a store (spec 0.7.1 7.4). A row in `store_suspensions` means the store is paused: it
// never resolves for anyone (lib/paused.ts, lib/active-store.ts) and nothing is deleted. Restoring deletes
// the row; the events stay. Each is ONE statement with its `platform_events` row and the store's
// `access_events` row signed "Liminal Bloom" (lib/admin/events.ts), or it changes nothing.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { type AdminActor, platformEventFrom, storeEventFrom } from "./events";

type Row = Record<string, unknown>;

export type PauseOutcome = { status: "done"; storeName: string } | { status: "gone" | "already" };

async function change(actor: AdminActor, storeId: string, reason: string, kind: "pause" | "restore"): Promise<PauseOutcome> {
  const paused = kind === "pause";
  const action = paused ? "store_paused" : "store_restored";
  const source = sql`changed c join target t on t.id = c.store_id`;
  const detail = sql`jsonb_build_object('store', t.name)`;
  const write = paused
    ? sql`insert into store_suspensions (store_id, reason, suspended_by, suspended_by_name)
        select id, ${reason}::text, ${actor.userId}::text, ${actor.name}::text from target on conflict (store_id) do nothing returning store_id`
    : sql`delete from store_suspensions where store_id in (select id from target) returning store_id`;
  const { rows } = await db.execute<Row>(sql`
    with target as (select id, name from organization where id = ${storeId}),
    changed as (${write}),
    logged as (${platformEventFrom(actor, { action, targetKind: "store", targetId: sql`t.id`, targetLabel: sql`t.name`, reason, detail }, source)}),
    storelog as (${storeEventFrom(sql`t.id`, action, sql`'{}'::jsonb`, source)})
    select t.name from ${source}`);
  if (rows[0]) return { status: "done", storeName: String(rows[0].name) };
  // Nothing changed: there is no such store, or it was already in the state asked for.
  const exists = await db.execute<Row>(sql`select 1 as found from organization where id = ${storeId}`);
  return { status: exists.rows.length === 0 ? "gone" : "already" };
}

/** Pauses a store. `already`: it is paused (the first reason stands). */
export const pauseStore = (actor: AdminActor, storeId: string, reason: string) => change(actor, storeId, reason, "pause");

/** Lifts a pause. `already`: it is not paused. */
export const restoreStore = (actor: AdminActor, storeId: string, reason: string) => change(actor, storeId, reason, "restore");
