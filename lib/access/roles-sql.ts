// The SQL pieces every role write shares (see roles-write.ts). They are CTEs, so a
// write is still one statement. Nothing here takes user text except as a bound value.

import "server-only";

import { sql } from "drizzle-orm";

import type { Snapshot } from "./roles-write";

/**
 * Locks every role of the store, in id order so two writers cannot deadlock. Under
 * READ COMMITTED, FOR UPDATE hands back the newest committed version of each row
 * after waiting, so what the rest of the statement checks is what is saved now,
 * not what the statement started with.
 */
export const lockedRoles = (storeId: string) =>
  sql`locked as materialized (select id, name, rank, builtin, switches, version, updated_at from role_definitions where store_id = ${storeId} order by id for update)`;

/**
 * `ok` is true when the roles are exactly those the write was planned from: the
 * same ids and ranks, and the Store Manager row untouched. A role added since
 * the read is invisible to this statement (its snapshot is older) but bumps that
 * row's `updated_at` (see `touchStamp`), so adding one is caught here too.
 */
export function pins(snapshot: Snapshot) {
  const seen = JSON.stringify(snapshot.roles.map((r) => ({ id: r.id, rank: r.rank })));
  const n = snapshot.roles.length;
  const stampOk =
    snapshot.stamp === null
      ? sql`not exists (select 1 from locked where builtin = 'store_manager')`
      : sql`exists (select 1 from locked where builtin = 'store_manager' and updated_at::text = ${snapshot.stamp})`;
  return sql`pins as materialized (
    select (select count(*) from locked) = ${n}
      and (select count(*) from locked l join jsonb_to_recordset(${seen}::jsonb) as s(id text, rank int) on s.id = l.id and s.rank = l.rank) = ${n}
      and ${stampOk} as ok)`;
}

/** Adding a role writes this stamp (only when the add goes ahead), so a write planned before it fails its pin. */
export const touchStamp = (storeId: string, stamp: string | null) =>
  sql`touched as (update role_definitions set updated_at = clock_timestamp() where store_id = ${storeId} and builtin = 'store_manager' and updated_at::text = ${stamp}::text and (select ok from pins) and not exists (select 1 from bad) returning id)`;

/**
 * The nesting rule over `final` (id, name, rank, switches after the change, `was`
 * before it, null for a role new or moved): a row here is a lower role holding
 * what a higher one lacks that this change is responsible for. It mirrors
 * `nestingProblem` in nesting.ts, which the tests hold it to.
 */
export const nestingBad = sql`bad as materialized (
  select 1 from final lo
    join final hi on hi.rank < lo.rank
    cross join lateral unnest(lo.switches) as u(s)
  where u.s <> all (hi.switches)
    and (lo.was is null or u.s <> all (lo.was) or hi.was is null or u.s = any (hi.was)))`;

/** A text[] value from a JS list (drizzle would expand a bare array into a row of parameters). */
export const textArray = (list: readonly string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(list)}::jsonb))`;
