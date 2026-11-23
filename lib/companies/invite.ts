// Inviting someone into a company role (spec 0.7.1 6.5). The checks and the write are ONE statement: the invitation
// and its company_events row exist together, the inviter must still hold the authority the rank check saw
// (authority.ts), and the pending limit and duplicate checks sit in it. Like a store invitation, the id is the link
// (192 random bits) and nothing is emailed. Unlike a store's, the pending-per-email rule is a real unique index, so
// an expired or lapsed pending invitation to the same address is cancelled in the same statement, first (the insert
// reads the update's result, so it cannot run before it). Runs as the table owner: the company id is filtered by hand
// and comes from the actor's own session.

import "server-only";

import { randomBytes } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { canAssignCompanyRole, companyRole, type AssignableCompanyRoleKey, type CompanyRoleKey } from "@/lib/access/company-roles";
import { cleanEmail } from "@/lib/access/invite";
import { INVITATION_HOURS } from "@/lib/access/invite-limits";

import { actorMayAct, inviterMayGrantCompany, rankOf, roleNameSql } from "./authority";

/** The most pending company invitations at once (spec 0.7.1 6.5). */
export const MAX_COMPANY_INVITATIONS = 100;

export type CompanyInviter = { userId: string; name: string; role: CompanyRoleKey };

export type CompanyInviteOutcome =
  | { status: "created"; id: string; email: string; roleName: string; expiresAt: Date }
  | { status: "already-member"; name: string }
  | { status: "bad-email" | "forbidden" | "invalid" | "already-invited" | "invitations-full" };

const ROLES: readonly string[] = ["corporate_admin", "regional_manager"];
const live = (nowText: string): SQL => sql`ci.status = 'pending' and ci.expires_at > ${nowText}::timestamptz and ${inviterMayGrantCompany(sql`ci.company_id`, sql`ci.role`, sql`ci.inviter_id`)}`;

export async function createCompanyInvitation(companyId: string, actor: CompanyInviter, rawEmail: string, roleKey: string, regionId: string | null, now: Date = new Date()): Promise<CompanyInviteOutcome> {
  const email = cleanEmail(rawEmail);
  if (!email) return { status: "bad-email" };
  if (!ROLES.includes(roleKey)) return { status: "invalid" };
  const role = roleKey as AssignableCompanyRoleKey;
  // A regional manager needs a region; a corporate admin has none (the table's check says the same).
  if ((role === "regional_manager") !== (regionId !== null)) return { status: "invalid" };
  if (!canAssignCompanyRole(actor.role, role)) return { status: "forbidden" };
  const { name: roleName } = companyRole(role);
  const nowText = now.toISOString();
  const id = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITATION_HOURS * 3_600_000);
  const company = sql`${companyId}::text`;
  const detail = sql`jsonb_build_object('email', ${email}::text, 'role', ${roleName}::text, 'region', (select name from regions where id = ${regionId}::text))`;

  const written = await db.execute(sql`
    with allowed as (
      select 1 where ${actorMayAct(company, sql`${actor.userId}::text`, rankOf(role))}
        and (${regionId}::text is null or exists (select 1 from regions where id = ${regionId}::text and company_id = ${company}))
        and not exists (select 1 from companies c join "user" u on u.id = c.owner_user_id where c.id = ${company} and lower(u.email) = ${email}::text)
        and not exists (select 1 from role_assignments ra join "user" u on u.id = ra.user_id where ra.company_id = ${company} and lower(u.email) = ${email}::text)
        and not exists (select 1 from company_invitations ci where ci.company_id = ${company} and lower(ci.email) = ${email}::text and ${live(nowText)})
        and (select count(*) from company_invitations ci where ci.company_id = ${company} and ${live(nowText)}) < ${MAX_COMPANY_INVITATIONS}),
    superseded as (
      update company_invitations ci set status = 'canceled'
      where ci.company_id = ${company} and lower(ci.email) = ${email}::text and ci.status = 'pending' and exists (select 1 from allowed)
      returning ci.id),
    made as (
      insert into company_invitations (id, company_id, email, role, region_id, inviter_id, status, expires_at)
      select ${id}::text, ${company}, ${email}::text, ${role}::company_role, ${regionId}::text, ${actor.userId}::text, 'pending', ${expiresAt.toISOString()}::timestamptz
      from allowed where (select count(*) from superseded) >= 0
      returning id),
    logged as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select ${company}, ${actor.userId}::text, ${actor.name}::text, 'company_invitation_created', ${detail} from made returning id)
    select id from logged`);
  if (written.rows.length > 0) return { status: "created", id, email, roleName, expiresAt };
  return whyNot(companyId, actor, email, role, regionId, nowText);
}

/** After the statement wrote nothing: which of its checks stopped it, in the order the dialog lists them. */
async function whyNot(companyId: string, actor: CompanyInviter, email: string, role: AssignableCompanyRoleKey, regionId: string | null, nowText: string): Promise<CompanyInviteOutcome> {
  const company = sql`${companyId}::text`;
  const [still] = (await db.execute<{ ok: boolean }>(sql`select ${actorMayAct(company, sql`${actor.userId}::text`, rankOf(role))} as ok`)).rows;
  if (!still?.ok) return { status: "forbidden" };
  if (regionId !== null && (await db.execute(sql`select 1 from regions where id = ${regionId} and company_id = ${companyId}`)).rows.length === 0) return { status: "invalid" };
  const there = await db.execute<{ name: string }>(sql`
    select u.name from "user" u where lower(u.email) = ${email} and (
      exists (select 1 from companies c where c.id = ${companyId} and c.owner_user_id = u.id)
      or exists (select 1 from role_assignments ra where ra.company_id = ${companyId} and ra.user_id = u.id))`);
  if (there.rows[0]) return { status: "already-member", name: there.rows[0].name };
  const dup = await db.execute(sql`select 1 from company_invitations ci where ci.company_id = ${companyId} and lower(ci.email) = ${email} and ${live(nowText)}`);
  return { status: dup.rows.length > 0 ? "already-invited" : "invitations-full" };
}

export type CancelCompanyInvitationOutcome = { status: "cancelled"; email: string } | { status: "forbidden" | "gone" };

/** Cancelling reaches only the roles the actor outranks, like inviting into them did; the write checks it again. */
export async function cancelCompanyInvitation(companyId: string, actor: CompanyInviter, invitationId: string): Promise<CancelCompanyInvitationOutcome> {
  const { rows } = await db.execute<{ email: string; role: AssignableCompanyRoleKey }>(sql`select email, role::text as role from company_invitations where id = ${invitationId} and company_id = ${companyId} and status = 'pending'`);
  const row = rows[0];
  if (!row) return { status: "gone" };
  if (!canAssignCompanyRole(actor.role, row.role)) return { status: "forbidden" };
  const company = sql`${companyId}::text`;
  const done = await db.execute(sql`
    with cancelled as (
      update company_invitations ci set status = 'canceled'
      where ci.id = ${invitationId} and ci.company_id = ${company} and ci.status = 'pending' and ${actorMayAct(company, sql`${actor.userId}::text`, rankOf(row.role))}
      returning ci.email, ci.role),
    logged as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select ${company}, ${actor.userId}::text, ${actor.name}::text, 'company_invitation_cancelled', jsonb_build_object('email', c.email, 'role', ${roleNameSql(sql`c.role`)}) from cancelled c returning id)
    select id from logged`);
  return done.rows.length > 0 ? { status: "cancelled", email: row.email } : { status: "gone" };
}
