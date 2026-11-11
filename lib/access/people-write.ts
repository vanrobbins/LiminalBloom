// Changing who is in a store and as what (spec 0.7, 4.3 and the spike findings
// under 4.5): re-role, remove, cancel an invitation. Better Auth's endpoints refuse
// anyone who is not its own owner or admin and know nothing of our roles, so these
// are the app's own writes to `member` and `invitation`. Each is ONE statement that
// changes the row and writes its access_events row together, so neither exists
// without the other, and each change is pinned to what the person saw (the role
// the target held when the dialog opened), so a stale dialog changes nothing.
//
// Runs as the table owner, not through withStore: the store role (app_store_user)
// cannot reach Better Auth's tables. Every statement is therefore filtered by the
// store id by hand. The actor comes from the action's guard, resolved fresh on
// this request (lib/current-member.ts), never from the browser.

import "server-only";

import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";

import { canActOn, type Actor } from "./rank";
import { NO_ROLE_NAME, NO_ROLE_RANK } from "./people-view";

export type PeopleActor = Actor & { userId: string; name: string };

export type Refusal = { status: "forbidden" | "stale" | "gone" | "invalid" | "last-manager" };

type Target = { memberId: string; userId: string; name: string; roleId: string | null; roleName: string; rank: number; isManager: boolean };

async function readTarget(storeId: string, memberId: string): Promise<Target | null> {
  const [row] = await db
    .select({
      memberId: member.id,
      userId: member.userId,
      name: user.name,
      roleId: member.roleId,
      roleName: roleDefinitions.name,
      rank: roleDefinitions.rank,
      builtin: roleDefinitions.builtin,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
    .where(and(eq(member.id, memberId), eq(member.organizationId, storeId)));
  if (!row) return null;
  return { ...row, roleName: row.roleName ?? NO_ROLE_NAME, rank: row.rank ?? NO_ROLE_RANK, isManager: row.builtin === "store_manager" };
}

/** Why this person may not be acted on, or null when the rank rule and the stale check pass. */
function refusalFor(actor: PeopleActor, target: Target, expectedRoleId: string | null): Refusal | null {
  // Equal rank is refused by canActOn, which also covers acting on yourself.
  if (target.userId === actor.userId || !canActOn(actor, target.rank, "people.manage")) return { status: "forbidden" };
  if (target.roleId !== expectedRoleId) return { status: "stale" };
  return null;
}

/** The last-Store-Manager guard also sits in the write itself, so two requests cannot both take the last one. */
async function isLastManager(storeId: string, target: Target): Promise<boolean> {
  if (!target.isManager || !target.roleId) return false;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(member).where(and(eq(member.organizationId, storeId), eq(member.roleId, target.roleId)));
  return row.n <= 1;
}

const stillManagerSafe = (storeId: string, target: Target) =>
  target.isManager ? sql`(select count(*) from member where organization_id = ${storeId} and role_id = ${target.roleId}::text) > 1` : sql`true`;

const logRow = (storeId: string, actor: PeopleActor, event: string, detail: Record<string, unknown>) =>
  sql`select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, ${event}::text, ${JSON.stringify(detail)}::jsonb`;

async function changedRows(write: SQL): Promise<number> {
  const result = await db.execute(write);
  return result.rows.length;
}

/** After a write matched nothing: the person is gone, or something about them changed since the dialog opened. */
async function whyNot(storeId: string, memberId: string): Promise<Refusal> {
  return { status: (await readTarget(storeId, memberId)) ? "stale" : "gone" };
}

export type ChangeOutcome = { status: "changed"; name: string; roleName: string } | Refusal;

export async function changeRole(storeId: string, actor: PeopleActor, memberId: string, expectedRoleId: string | null, newRoleId: string): Promise<ChangeOutcome> {
  const target = await readTarget(storeId, memberId);
  if (!target) return { status: "gone" };
  const refused = refusalFor(actor, target, expectedRoleId);
  if (refused) return refused;
  const [role] = await db.select().from(roleDefinitions).where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.id, newRoleId)));
  if (!role || role.id === target.roleId) return { status: "invalid" };
  if (!canActOn(actor, role.rank, "people.manage")) return { status: "forbidden" };
  if (await isLastManager(storeId, target)) return { status: "last-manager" };

  const log = logRow(storeId, actor, "member_role_changed", { person: target.name, from: target.roleName, to: role.name, memberId });
  const rows = await changedRows(sql`
    with changed as (
      update member set role_id = ${newRoleId}
      where id = ${memberId} and organization_id = ${storeId}
        and role_id is not distinct from ${expectedRoleId}::text
        and ${stillManagerSafe(storeId, target)}
      returning id)
    insert into access_events (store_id, actor_id, actor_name, event, detail)
    ${log} from changed returning id`);
  return rows === 0 ? whyNot(storeId, memberId) : { status: "changed", name: target.name, roleName: role.name };
}

export type RemoveOutcome = { status: "removed"; name: string } | Refusal;

export async function removePerson(storeId: string, actor: PeopleActor, memberId: string, expectedRoleId: string | null): Promise<RemoveOutcome> {
  const target = await readTarget(storeId, memberId);
  if (!target) return { status: "gone" };
  const refused = refusalFor(actor, target, expectedRoleId);
  if (refused) return refused;
  if (await isLastManager(storeId, target)) return { status: "last-manager" };

  const log = logRow(storeId, actor, "member_removed", { person: target.name, role: target.roleName, memberId });
  const rows = await changedRows(sql`
    with removed as (
      delete from member
      where id = ${memberId} and organization_id = ${storeId}
        and role_id is not distinct from ${expectedRoleId}::text
        and ${stillManagerSafe(storeId, target)}
      returning id)
    insert into access_events (store_id, actor_id, actor_name, event, detail)
    ${log} from removed returning id`);
  return rows === 0 ? whyNot(storeId, memberId) : { status: "removed", name: target.name };
}

export type CancelOutcome = { status: "cancelled"; email: string } | { status: "forbidden" | "gone" };

/** Cancelling an invitation reaches only the roles the actor outranks, like inviting into them did. */
export async function cancelInvitation(storeId: string, actor: PeopleActor, invitationId: string): Promise<CancelOutcome> {
  const [row] = await db
    .select({ email: invitation.email, roleName: roleDefinitions.name, rank: roleDefinitions.rank })
    .from(invitation)
    .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, invitation.organizationId), eq(roleDefinitions.id, invitation.roleId)))
    .where(and(eq(invitation.id, invitationId), eq(invitation.organizationId, storeId), eq(invitation.status, "pending")));
  if (!row) return { status: "gone" };
  if (!canActOn(actor, row.rank ?? NO_ROLE_RANK, "people.manage")) return { status: "forbidden" };

  const log = logRow(storeId, actor, "invitation_cancelled", { email: row.email, role: row.roleName ?? NO_ROLE_NAME, invitationId });
  const rows = await changedRows(sql`
    with cancelled as (
      update invitation set status = 'canceled'
      where id = ${invitationId} and organization_id = ${storeId} and status = 'pending'
      returning id)
    insert into access_events (store_id, actor_id, actor_name, event, detail)
    ${log} from cancelled returning id`);
  return rows === 0 ? { status: "gone" } : { status: "cancelled", email: row.email };
}
