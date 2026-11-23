// Changing what roles can do (spec 0.7, 4.8 parts 3 and 4): the staged batch the
// screen saves after its summary, and Reset to default. One statement each:
// it locks the store's roles, pins the batch to the versions the person saw,
// refuses if the FINAL state of all roles would not nest (nesting.ts, DECISIONS
// 11-11), writes the roles and one access_events row per role. All or nothing.

import "server-only";

import { sql } from "drizzle-orm";

import { nestingProblem, type NestRole } from "./nesting";
import { isSyntheticRoleId } from "./company-roles";
import { canActOn, canGrant } from "./rank";
import { builtinRole, LOCKED_SWITCHES, withLockedSwitches, type BuiltinRoleKey } from "./roles";
import { lockedRoles, nestingBad, pins } from "./roles-sql";
import { isRefusal, readSnapshot, runRoleWrite, type DbRole, type RoleRefusal, type RolesActor, type Snapshot } from "./roles-write";
import { SWITCHES, type Switch } from "./switches";

export type SwitchEdit = { roleId: string; version: number; switches: Switch[] };
export type SaveOutcome = { status: "saved"; roles: number } | RoleRefusal;
export type ResetOutcome = { status: "reset"; name: string } | RoleRefusal;

export type Planned = { role: DbRole; next: Switch[]; name: string };

const symmetric = (a: readonly Switch[], b: readonly Switch[]) => SWITCHES.filter((s) => a.includes(s) !== b.includes(s));

/** The roles as they would stand after the plan, for the nesting check. Roles not in the plan are untouched. */
function finalState(roles: DbRole[], planned: Planned[]): NestRole[] {
  return roles.map((r) => {
    const p = planned.find((x) => x.role.id === r.id);
    return { id: r.id, name: p?.name ?? r.name, rank: r.rank, switches: p?.next ?? r.switches, was: r.switches };
  });
}

/** The refusal a plan earns before any SQL, other than the rank rule (the caller checks that): grant, nesting. */
function checkPlan(snapshot: Snapshot, actor: RolesActor, planned: Planned[]): RoleRefusal | null {
  // Turning a permission off needs it as much as turning it on: nothing you can't undo.
  if (!canGrant(actor, planned.flatMap((p) => symmetric(p.role.switches, p.next)))) return { status: "grant" };
  const problem = nestingProblem(finalState(snapshot.roles, planned));
  return problem ? { status: "nesting", problem } : null;
}

/**
 * The one statement, exported so a race test can run it with a snapshot that is out of date. `planned` carries each role's new switches and name; its
 * versions pin it, and so do the roles as read (pins). Zero rows back means
 * nothing was written.
 */
export async function applyChanges(storeId: string, actor: RolesActor, snapshot: Snapshot, planned: Planned[], event: "role_switches_changed" | "role_reset") {
  const json = JSON.stringify(planned.map((p) => ({ id: p.role.id, version: p.role.version, switches: p.next, name: p.name })));
  return runRoleWrite(sql`
    with ${lockedRoles(storeId)},
    ${pins(snapshot)},
    changes as materialized (
      select c.id, c.version, c.name, array(select jsonb_array_elements_text(c.switches)) as switches
      from jsonb_to_recordset(${json}::jsonb) as c(id text, version int, name text, switches jsonb)),
    final as materialized (
      select l.id, l.name, l.rank, coalesce(c.switches, l.switches) as switches, l.switches as was
      from locked l left join changes c on c.id = l.id),
    ${nestingBad},
    updated as (
      update role_definitions r set switches = c.switches, name = c.name, version = r.version + 1, updated_at = now(),
        -- A role that newly gains a people or roles permission starts requiring two-factor (security first); a save never turns it off.
        requires_two_factor = r.requires_two_factor or exists (
          select 1 from unnest(c.switches) x where x in ('people.manage', 'roles.manage') and x <> all (l.switches))
      from changes c join locked l on l.id = c.id and l.version = c.version
      where r.store_id = ${storeId} and r.id = c.id
        and (select ok from pins)
        and (select count(*) from changes c2 join locked l2 on l2.id = c2.id and l2.version = c2.version) = (select count(*) from changes)
        and not exists (select 1 from bad)
      returning r.id, r.name, l.name as old_name, l.switches as old_switches, c.switches as new_switches),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, ${event}::text,
        jsonb_build_object('role', u.name, 'from', u.old_name,
          'added', coalesce((select jsonb_agg(x) from unnest(u.new_switches) x where x <> all (u.old_switches)), '[]'::jsonb),
          'removed', coalesce((select jsonb_agg(x) from unnest(u.old_switches) x where x <> all (u.new_switches)), '[]'::jsonb))
      from updated u returning id)
    select id from updated`);
}

/** After a write that matched nothing: say why, from the roles as they are now. */
async function whyNot(storeId: string, edits: { roleId: string; version: number }[], planned: Planned[], actor: RolesActor): Promise<RoleRefusal> {
  const now = await readSnapshot(storeId);
  for (const e of edits) {
    const role = now.roles.find((r) => r.id === e.roleId);
    if (!role) return { status: "gone" };
    if (role.version !== e.version) return { status: "stale" };
  }
  // The roles beside the batch moved or one was added: the same checks against what is there now.
  const fresh = planned.map((p) => ({ ...p, role: now.roles.find((r) => r.id === p.role.id)! }));
  return checkPlan(now, actor, fresh) ?? { status: "stale" };
}

export async function saveSwitches(storeId: string, actor: RolesActor, edits: SwitchEdit[]): Promise<SaveOutcome> {
  if (edits.length === 0 || new Set(edits.map((e) => e.roleId)).size !== edits.length || edits.some((e) => isSyntheticRoleId(e.roleId))) return { status: "invalid" };
  const snapshot = await readSnapshot(storeId);
  for (const e of edits) {
    const role = snapshot.roles.find((r) => r.id === e.roleId);
    if (!role) return { status: "gone" };
    if (!canActOn(actor, role.rank, "roles.manage")) return { status: "forbidden" };
  }
  const planned: Planned[] = [];
  for (const e of edits) {
    const role = snapshot.roles.find((r) => r.id === e.roleId)!;
    if (role.version !== e.version) return { status: "stale" };
    const key = role.builtin as BuiltinRoleKey | null;
    // The Store Manager's three can't be edited out; `view` is put back silently (roles.ts).
    if (key === "store_manager" && LOCKED_SWITCHES.store_manager.some((s) => !e.switches.includes(s))) return { status: "locked" };
    const next = [...withLockedSwitches(e.switches, key)];
    if (symmetric(role.switches, next).length > 0) planned.push({ role, next, name: role.name });
  }
  if (planned.length === 0) return { status: "invalid" };
  const refused = checkPlan(snapshot, actor, planned);
  if (refused) return refused;
  const written = await applyChanges(storeId, actor, snapshot, planned, "role_switches_changed");
  if (isRefusal(written)) return written;
  return written.rows.length === planned.length ? { status: "saved", roles: planned.length } : whyNot(storeId, edits, planned, actor);
}

/** A built-in's name and permissions back to what it shipped with. Its place in the order stays. */
export async function resetRole(storeId: string, actor: RolesActor, roleId: string, version: number): Promise<ResetOutcome> {
  if (isSyntheticRoleId(roleId)) return { status: "invalid" };
  const snapshot = await readSnapshot(storeId);
  const role = snapshot.roles.find((r) => r.id === roleId);
  if (!role) return { status: "gone" };
  if (!canActOn(actor, role.rank, "roles.manage")) return { status: "forbidden" };
  if (role.version !== version) return { status: "stale" };
  if (role.builtin === null) return { status: "invalid" };
  const base = builtinRole(role.builtin as BuiltinRoleKey);
  const next = [...withLockedSwitches(base.switches, base.key)];
  if (symmetric(role.switches, next).length === 0 && role.name === base.name) return { status: "invalid" };
  const planned = [{ role, next, name: base.name }];
  const refused = checkPlan(snapshot, actor, planned);
  if (refused) return refused;
  const written = await applyChanges(storeId, actor, snapshot, planned, "role_reset");
  if (isRefusal(written)) return written;
  return written.rows.length === 1 ? { status: "reset", name: base.name } : whyNot(storeId, [{ roleId, version }], planned, actor);
}
