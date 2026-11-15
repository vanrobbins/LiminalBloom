// Adding, renaming and moving roles (spec 0.7, 4.8 parts 4 and 5). One statement
// each, pinned to what the person saw; adding and moving also lock the store's
// roles and refuse a result that would not nest (nesting.ts, DECISIONS 11-11).

import "server-only";

import { sql } from "drizzle-orm";

import { nestingProblem } from "./nesting";
import { canActOn, canGrant, rankBetween, renumberRanks } from "./rank";
import { withLockedSwitches } from "./roles";
import { lockedRoles, nestingBad, pins, textArray, touchStamp } from "./roles-sql";
import { checkName, isRefusal, readSnapshot, runRoleWrite, sameName, type DbRole, type RoleRefusal, type RolesActor, type Snapshot } from "./roles-write";
import type { Switch } from "./switches";

export type CreateOutcome = { status: "created"; name: string } | RoleRefusal;
export type RenameOutcome = { status: "renamed"; from: string; to: string } | RoleRefusal;
export type MoveOutcome = { status: "moved"; name: string; past: string; direction: "up" | "down" } | RoleRefusal;

/** The id the nesting check gives a role that does not exist yet. */
export const NEW_ROLE_ID = "(new)";

/** Where a new role goes: its rank, and fresh ranks for every role when the gap below its neighbour is full. */
export type Placement = { rank: number; ranks: { id: string; rank: number }[] };

function place(snapshot: Snapshot, belowId: string): Placement | null {
  const i = snapshot.roles.findIndex((r) => r.id === belowId);
  if (i < 0) return null;
  const below = snapshot.roles[i];
  const rank = rankBetween(below.rank, snapshot.roles[i + 1]?.rank ?? null);
  if (rank !== null) return { rank, ranks: snapshot.roles.map((r) => ({ id: r.id, rank: r.rank })) };
  const ordered = [...snapshot.roles.slice(0, i + 1), { id: NEW_ROLE_ID, rank: below.rank }, ...snapshot.roles.slice(i + 1)].map((r) => ({ id: r.id, rank: r.rank }));
  const renumbered = renumberRanks(ordered);
  return { rank: renumbered[i + 1].rank, ranks: renumbered.filter((r) => r.id !== NEW_ROLE_ID) };
}

export async function createRole(storeId: string, actor: RolesActor, input: { name: string; belowId: string; switches: Switch[] }): Promise<CreateOutcome> {
  const checked = checkName(input.name);
  if (!checked.ok) return { status: checked.status };
  const snapshot = await readSnapshot(storeId);
  const placed = place(snapshot, input.belowId);
  if (!placed) return { status: "gone" };
  // Only below your own role: "Below" your own role is the highest place there is.
  if (snapshot.roles.find((r) => r.id === input.belowId)!.rank < actor.rank) return { status: "rank" };
  const switches = [...withLockedSwitches(input.switches, null)];
  if (!canGrant(actor, switches)) return { status: "grant" };
  if (snapshot.roles.some((r) => sameName(r.name, checked.name))) return { status: "taken" };
  const ranks = new Map(placed.ranks.map((r) => [r.id, r.rank]));
  const problem = nestingProblem([
    ...snapshot.roles.map((r) => ({ id: r.id, name: r.name, rank: ranks.get(r.id)!, switches: r.switches, was: r.switches })),
    { id: NEW_ROLE_ID, name: checked.name, rank: placed.rank, switches },
  ]);
  if (problem) return { status: "nesting", problem };

  return insertRole(storeId, actor, snapshot, placed, checked.name, switches);
}

/** The add itself, after the checks. Exported so a test can run it with a snapshot that is out of date: the pins are what hold then. */
export async function insertRole(storeId: string, actor: RolesActor, snapshot: Snapshot, placed: Placement, name: string, switches: Switch[]): Promise<CreateOutcome> {
  const done = await runRoleWrite(sql`
    with ${lockedRoles(storeId)},
    ${pins(snapshot)},
    renumber as materialized (select r.id, r.rank from jsonb_to_recordset(${JSON.stringify(placed.ranks)}::jsonb) as r(id text, rank int)),
    final as materialized (
      select l.id, l.name, rn.rank, l.switches, l.switches as was from locked l join renumber rn on rn.id = l.id
      union all select ${NEW_ROLE_ID}::text, ${name}::text, ${placed.rank}::int, ${textArray(switches)}, null::text[]),
    ${nestingBad},
    ${touchStamp(storeId, snapshot.stamp)},
    moved as (
      update role_definitions r set rank = rn.rank
      from renumber rn
      where r.store_id = ${storeId} and r.id = rn.id and r.rank <> rn.rank and (select ok from pins) and not exists (select 1 from bad)
      returning r.id),
    made as (
      insert into role_definitions (store_id, name, rank, switches)
      select ${storeId}::text, ${name}::text, ${placed.rank}::int, ${textArray(switches)}
      where (select ok from pins) and not exists (select 1 from bad)
      returning id, name),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, 'role_created', jsonb_build_object('role', m.name) from made m returning id)
    select id from made`);
  if (isRefusal(done)) return done;
  return done.rows.length === 1 ? { status: "created", name } : { status: "stale" };
}

export async function renameRole(storeId: string, actor: RolesActor, roleId: string, version: number, rawName: string): Promise<RenameOutcome> {
  const checked = checkName(rawName);
  if (!checked.ok) return { status: checked.status };
  const { roles } = await readSnapshot(storeId);
  const role = roles.find((r) => r.id === roleId);
  if (!role) return { status: "gone" };
  if (!canActOn(actor, role.rank, "roles.manage")) return { status: "forbidden" };
  if (role.version !== version) return { status: "stale" };
  if (roles.some((r) => r.id !== roleId && sameName(r.name, checked.name))) return { status: "taken" };
  if (role.name === checked.name) return { status: "invalid" };
  return applyRename(storeId, actor, role, checked.name);
}

/** The rename itself, after the checks; exported so a test can run it on a role whose version moved since it was read: the pins in the SQL (version and rank) are what hold then. */
export async function applyRename(storeId: string, actor: RolesActor, role: DbRole, name: string): Promise<RenameOutcome> {
  const done = await runRoleWrite(sql`
    with renamed as (
      update role_definitions r set name = ${name}, version = r.version + 1, updated_at = now()
      from role_definitions old
      where r.store_id = ${storeId} and r.id = ${role.id} and r.version = ${role.version} and r.rank = ${role.rank}::int and old.id = r.id
      returning old.name as old_name, r.name as new_name),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, 'role_renamed', jsonb_build_object('from', n.old_name, 'to', n.new_name, 'role', n.new_name) from renamed n returning id)
    select id from logged`);
  if (isRefusal(done)) return done;
  if (done.rows.length === 1) return { status: "renamed", from: role.name, to: name };
  const again = (await readSnapshot(storeId)).roles.find((r) => r.id === role.id);
  return { status: again ? "stale" : "gone" };
}

/** Swaps a custom role with the role beside it. `neighbourId` is the one the person saw there. */
export async function moveRole(storeId: string, actor: RolesActor, roleId: string, direction: "up" | "down", neighbourId: string): Promise<MoveOutcome> {
  const snapshot = await readSnapshot(storeId);
  const i = snapshot.roles.findIndex((r) => r.id === roleId);
  if (i < 0) return { status: "gone" };
  const role = snapshot.roles[i];
  if (!canActOn(actor, role.rank, "roles.manage")) return { status: "forbidden" };
  if (role.builtin !== null) return { status: "invalid" };
  const other = snapshot.roles[direction === "up" ? i - 1 : i + 1];
  if (!other || other.id !== neighbourId) return { status: "stale" };
  // The role that takes its place must be one the actor could place a role at.
  if (!canActOn(actor, other.rank, "roles.manage")) return { status: "rank" };
  const swapped = snapshot.roles.map((r) => ({ id: r.id, name: r.name, rank: r.id === role.id ? other.rank : r.id === other.id ? role.rank : r.rank, switches: r.switches }));
  // Both swapped roles have no baseline, so every pair they are in is checked (nesting.ts).
  const problem = nestingProblem(swapped.map((r) => (r.id === role.id || r.id === other.id ? r : { ...r, was: r.switches })));
  if (problem) return { status: "nesting", problem };

  return swapRanks(storeId, actor, snapshot, role, other, direction);
}

/** The swap itself, after the checks; exported for the same reason as insertRole. */
export async function swapRanks(storeId: string, actor: RolesActor, snapshot: Snapshot, role: DbRole, other: DbRole, direction: "up" | "down"): Promise<MoveOutcome> {
  const done = await runRoleWrite(sql`
    with ${lockedRoles(storeId)},
    ${pins(snapshot)},
    final as materialized (
      select l.id, l.name, case when l.id = ${role.id} then ${other.rank}::int when l.id = ${other.id} then ${role.rank}::int else l.rank end as rank,
        l.switches, case when l.id in (${role.id}, ${other.id}) then null else l.switches end as was
      from locked l),
    ${nestingBad},
    swapped as (
      update role_definitions r set rank = case when r.id = ${role.id} then ${other.rank}::int else ${role.rank}::int end, updated_at = now()
      where r.store_id = ${storeId} and r.id in (${role.id}, ${other.id}) and (select ok from pins) and not exists (select 1 from bad)
      returning r.id),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, 'role_reordered', jsonb_build_object('role', ${role.name}::text, 'past', ${other.name}::text, 'direction', ${direction}::text)
      from swapped s where s.id = ${role.id} returning id)
    select id from swapped`);
  if (isRefusal(done)) return done;
  return done.rows.length === 2 ? { status: "moved", name: role.name, past: other.name, direction } : { status: "stale" };
}
