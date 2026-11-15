// Deleting a custom role (spec 0.7, 4.8 part 4). A role someone holds is deleted
// only together with moving them: members and pending invitations go to another
// role in the same statement, one access_events row per person and one for the
// role. Pinned to the count the person saw, so someone joining meanwhile refreshes
// the dialog instead of being moved unseen. Built-ins are never deleted (Van, 11-11).

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { byName } from "@/lib/natural-sort";

import { canActOn } from "./rank";
import { lockedRoles, pins } from "./roles-sql";
import { isRefusal, readSnapshot, runRoleWrite, type DbRole, type RoleRefusal, type RolesActor, type Snapshot } from "./roles-write";

export type DeleteInput = { roleId: string; version: number; moveToId: string | null; members: number; invitations: number };
export type PeopleNow = { names: string[]; invitations: number };
export type DeleteOutcome = { status: "deleted"; name: string; moved: number; movedTo: string | null } | { status: "people-changed"; names: string[]; invitations: number } | RoleRefusal;

/** Who holds a role now: their names, and the pending invitations into it (expired ones included, as People shows them). */
export async function peopleOf(storeId: string, roleId: string): Promise<PeopleNow> {
  const [named, [pending]] = await Promise.all([
    db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.organizationId, storeId), eq(member.roleId, roleId))),
    db.select({ n: sql<number>`count(*)::int` }).from(invitation).where(and(eq(invitation.organizationId, storeId), eq(invitation.roleId, roleId), eq(invitation.status, "pending"))),
  ]);
  return { names: byName(named).map((p) => p.name), invitations: pending.n };
}

const same = (now: PeopleNow, input: DeleteInput) => now.names.length === input.members && now.invitations === input.invitations;

export async function deleteRole(storeId: string, actor: RolesActor, input: DeleteInput): Promise<DeleteOutcome> {
  const snapshot = await readSnapshot(storeId);
  const role = snapshot.roles.find((r) => r.id === input.roleId);
  if (!role) return { status: "gone" };
  if (!canActOn(actor, role.rank, "roles.manage")) return { status: "forbidden" };
  if (role.version !== input.version) return { status: "stale" };
  if (role.builtin !== null) return { status: "invalid" };
  const now = await peopleOf(storeId, role.id);
  if (!same(now, input)) return { status: "people-changed", ...now };
  const people = input.members + input.invitations;
  const dest = people > 0 ? snapshot.roles.find((r) => r.id === input.moveToId && r.id !== role.id) : undefined;
  if (people > 0) {
    // Moving people is the people switch's job, and only into roles the actor may hand out.
    if (!actor.switches.has("people.manage")) return { status: "cant-move-people" };
    if (!dest) return { status: "invalid" };
    if (!canActOn(actor, dest.rank, "people.manage")) return { status: "rank" };
  }

  return applyDelete(storeId, actor, snapshot, role, dest, input);
}

/** The delete and its moves, after the checks. Exported so a test can run it with a snapshot that is out of date: the pins and the counts are what hold then. */
export async function applyDelete(storeId: string, actor: RolesActor, snapshot: Snapshot, role: DbRole, dest: DbRole | undefined, input: DeleteInput): Promise<DeleteOutcome> {
  const people = input.members + input.invitations;
  const who = sql`${storeId}::text, ${actor.userId}::text, ${actor.name}::text`;
  const written = await runRoleWrite(sql`
    with ${lockedRoles(storeId)},
    ${pins(snapshot)},
    target as materialized (select id, name from locked where id = ${role.id} and version = ${role.version} and builtin is null),
    dest as materialized (select id, name from locked where id = ${dest?.id ?? null}::text),
    counts as materialized (
      select (select count(*) from member where organization_id = ${storeId} and role_id = ${role.id}) as members,
             (select count(*) from invitation where organization_id = ${storeId} and role_id = ${role.id} and status = 'pending') as invites),
    go as materialized (
      select (select ok from pins) and exists (select 1 from target)
        and (select members from counts) = ${input.members} and (select invites from counts) = ${input.invitations}
        and (${people}::int = 0 or exists (select 1 from dest)) as ok),
    moved_members as (
      update member m set role_id = (select id from dest)
      from "user" u
      where m.organization_id = ${storeId} and m.role_id = ${role.id} and u.id = m.user_id and (select ok from go)
      returning m.id as member_id, u.name as person),
    moved_invites as (
      update invitation set role_id = (select id from dest)
      where organization_id = ${storeId} and role_id = ${role.id} and status = 'pending' and (select ok from go)
      returning id),
    unlinked as (
      update invitation set role_id = null
      where organization_id = ${storeId} and role_id = ${role.id} and status <> 'pending' and (select ok from go)
      returning id),
    deleted as (
      delete from role_definitions
      where store_id = ${storeId} and id = ${role.id} and version = ${role.version} and builtin is null and (select ok from go)
      returning id, name),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${who}, 'member_role_changed', jsonb_build_object('person', mm.person, 'from', (select name from target), 'to', (select name from dest), 'memberId', mm.member_id)
      from moved_members mm
      union all
      select ${who}, 'role_deleted', jsonb_build_object('role', d.name, 'movedTo', (select name from dest), 'people', (select count(*) from moved_members), 'invitations', (select count(*) from moved_invites))
      from deleted d
      returning id)
    select id from deleted`);
  if (!isRefusal(written) && written.rows.length === 1) return { status: "deleted", name: role.name, moved: people, movedTo: dest?.name ?? null };
  return whyNot(storeId, role.id, input, isRefusal(written) ? written : null);
}

/** After a delete wrote nothing: the role is gone, or changed, or its people did. */
async function whyNot(storeId: string, roleId: string, input: DeleteInput, refused: RoleRefusal | null): Promise<DeleteOutcome> {
  if (refused && refused.status !== "stale") return refused;
  const again = (await readSnapshot(storeId)).roles.find((r) => r.id === roleId);
  if (!again) return { status: "gone" };
  if (again.version !== input.version) return { status: "stale" };
  const now = await peopleOf(storeId, roleId);
  return same(now, input) ? { status: "stale" } : { status: "people-changed", ...now };
}
