// The help actions that touch an account or a store's people (spec 0.7.1 7.4): Sign out everywhere,
// Cancel invitation, Make Store Manager. Each is ONE statement (lib/admin/events.ts): the change, the
// `platform_events` row and, where a store is touched, its `access_events` row signed "Liminal Bloom",
// all or nothing; an action that changes nothing writes no event. Pause, Restore and Reset two-factor
// are in actions-pause.ts and actions-two-factor.ts, admins in admins.ts.
//
// Runs as the table owner, which is why every statement filters by the ids it was given. Nothing here
// authorises anything: each server action has already awaited requirePlatformAdminForAction and passes
// the admin it returned as `actor`, and a reason cleaned by ./reason.ts.

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";

import { type AdminActor, platformEventFrom, storeEventFrom } from "./events";

type Row = Record<string, unknown>;

export type SignOutOutcome = { status: "done"; sessions: number } | { status: "gone" };

/** Deletes every session of the person. */
export async function signOutEverywhere(actor: AdminActor, userId: string, reason: string): Promise<SignOutOutcome> {
  const { rows } = await db.execute<Row>(sql`
    with target as (select id, email from "user" where id = ${userId}),
    ended as (delete from session where user_id in (select id from target) returning id),
    logged as (${platformEventFrom(actor, { action: "signed_out_everywhere", targetKind: "user", targetId: sql`t.id`, targetLabel: sql`t.email`, reason, detail: sql`jsonb_build_object('sessions', (select count(*) from ended))` }, sql`target t`)})
    select (select count(*) from ended)::int as sessions, (select count(*) from target)::int as found`);
  return rows[0]?.found === 1 ? { status: "done", sessions: Number(rows[0].sessions) } : { status: "gone" };
}

export type CancelOutcome = { status: "done"; email: string; storeName: string } | { status: "gone" };

/** Cancels a pending store invitation (the one a stuck person cannot cancel themselves). */
export async function cancelStoreInvitation(actor: AdminActor, invitationId: string, reason: string): Promise<CancelOutcome> {
  const detail = sql`jsonb_build_object('store', c.store_name, 'storeId', c.store_id)`;
  const storeDetail = sql`jsonb_build_object('email', c.email, 'role', coalesce(c.role_name, 'No role'), 'invitationId', c.id)`;
  const { rows } = await db.execute<Row>(sql`
    with changed as (
      update invitation i set status = 'canceled'
      from organization o
      where i.id = ${invitationId} and i.status = 'pending' and o.id = i.organization_id
      returning i.id, i.email, i.organization_id as store_id, o.name as store_name,
        (select rd.name from role_definitions rd where rd.store_id = i.organization_id and rd.id = i.role_id) as role_name),
    logged as (${platformEventFrom(actor, { action: "invitation_canceled", targetKind: "invitation", targetId: sql`c.id`, targetLabel: sql`c.email`, reason, detail }, sql`changed c`)}),
    storelog as (${storeEventFrom(sql`c.store_id`, "invitation_cancelled", storeDetail, sql`changed c`)})
    select email, store_name from changed`);
  return rows[0] ? { status: "done", email: String(rows[0].email), storeName: String(rows[0].store_name) } : { status: "gone" };
}

export type ManagerOutcome = { status: "done"; name: string } | { status: "gone" | "already" | "invalid" };

/**
 * Sets a member's role to the store's Store Manager role. Existing Store Managers keep theirs. `gone`: the
 * person is not in that store; `already`: they are a Store Manager; `invalid`: the store has no such role.
 */
export async function makeStoreManager(actor: AdminActor, storeId: string, userId: string, reason: string): Promise<ManagerOutcome> {
  const source = sql`before b join changed c on c.id = b.member_id`;
  const detail = sql`jsonb_build_object('store', b.store_name, 'storeId', ${storeId}::text, 'from', coalesce(b.from_role, 'No role'))`;
  const storeDetail = sql`jsonb_build_object('person', b.person, 'from', coalesce(b.from_role, 'No role'), 'to', (select name from mgr), 'memberId', b.member_id)`;
  const { rows } = await db.execute<Row>(sql`
    with mgr as (select id, name from role_definitions where store_id = ${storeId} and builtin = 'store_manager'),
    before as (
      select m.id as member_id, m.role_id, u.id as user_id, u.name as person, u.email, o.name as store_name,
        (select rd.name from role_definitions rd where rd.store_id = m.organization_id and rd.id = m.role_id) as from_role
      from member m join "user" u on u.id = m.user_id join organization o on o.id = m.organization_id
      where m.organization_id = ${storeId} and m.user_id = ${userId}),
    changed as (
      update member set role_id = (select id from mgr)
      where organization_id = ${storeId} and exists (select 1 from mgr)
        and id in (select member_id from before where role_id is distinct from (select id from mgr))
      returning id),
    logged as (${platformEventFrom(actor, { action: "store_manager_made", targetKind: "user", targetId: sql`b.user_id`, targetLabel: sql`b.email`, reason, detail }, source)}),
    storelog as (${storeEventFrom(storeId, "member_role_changed", storeDetail, source)})
    select b.person from ${source}`);
  if (rows[0]) return { status: "done", name: String(rows[0].person) };
  const [row] = await db.select({ roleId: member.roleId }).from(member).where(and(eq(member.organizationId, storeId), eq(member.userId, userId)));
  if (!row) return { status: "gone" };
  const [manager] = await db.select({ id: roleDefinitions.id }).from(roleDefinitions).where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.builtin, "store_manager")));
  if (!manager) return { status: "invalid" };
  return { status: row.roleId === manager.id ? "already" : "gone" };
}
