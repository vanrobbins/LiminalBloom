// Accepting a company invitation (spec 0.7.1 5.4, 6.5): ONE statement flips the invitation, inserts the person's
// role_assignments row and writes the company_events row, so none exists without the others. The conditions sit in
// the statement itself: pending, unexpired, this person's email, the inviter still holds the authority (a lapse, the
// inviter's rows locked FOR SHARE as a store accept does), the person holds no company role or ownership at all (a
// company person is only ever one), and is in no other company through a store (one-company.ts). Two accepts of
// the same link cannot both win; two grants for one person are serialized by an advisory lock first in the batch (one-company.ts); role_assignments'
// primary key stays as a backstop, an error answered "stale". Never writes a `member` row.
//
// The person comes from the action's session. Runs as the table owner.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { AcceptOutcome } from "@/lib/access/invitation-accept";

import { inviterMayGrantCompany, roleNameSql } from "./authority";
import { lookCompanyInvitation } from "./invite-look";
import { inOtherCompany, lockPersonGrants } from "./one-company";

export type CompanyAccept = { status: "accepted"; companyId: string; regionId: string | null; companyName: string; roleName: string } | Exclude<AcceptOutcome, { status: "accepted" }>;

const hasCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && (("code" in error && error.code === code) || ("cause" in error && hasCode(error.cause, code)));

type Person = { id: string; name: string; email: string };

/** Null when no company invitation has this id, so the caller tries a store invitation. */
export async function acceptCompanyInvitation(person: Person, invitationId: string, now: Date = new Date()): Promise<CompanyAccept | null> {
  const known = await db.execute(sql`select 1 from company_invitations where id = ${invitationId}`);
  if (known.rows.length === 0) return null;
  const email = person.email.trim().toLowerCase();
  const me = sql`${person.id}::text`;
  let rows: { company_id: string; region_id: string | null; company_name: string; role_name: string }[];
  try {
    const [, result] = await db.batch([lockPersonGrants(person.id), db.execute<{ company_id: string; region_id: string | null; company_name: string; role_name: string }>(sql`
      with taken as (
        update company_invitations i set status = 'accepted'
        where i.id = ${invitationId}::text and i.status = 'pending' and i.expires_at > ${now.toISOString()}::timestamptz
          and lower(i.email) = ${email}::text
          and ${inviterMayGrantCompany(sql`i.company_id`, sql`i.role`, sql`i.inviter_id`, true)}
          and not exists (select 1 from companies c where c.owner_user_id = ${me})
          and not exists (select 1 from role_assignments ra where ra.user_id = ${me})
          and not ${inOtherCompany(me, sql`i.company_id`)}
        returning i.company_id, i.role, i.region_id),
      added as (
        insert into role_assignments (user_id, company_id, role, region_id)
        select ${me}, t.company_id, t.role, t.region_id from taken t
        returning company_id, role, region_id),
      named as (
        select a.company_id, a.region_id, c.name as company_name, ${roleNameSql(sql`a.role`)} as role_name, g.name as region_name
        from added a join companies c on c.id = a.company_id left join regions g on g.id = a.region_id),
      logged as (
        insert into company_events (company_id, actor_id, actor_name, event, detail)
        select company_id, ${me}, ${person.name}::text, 'company_role_given', jsonb_build_object('person', ${person.name}::text, 'role', role_name, 'region', region_name)
        from named returning id)
      select company_id, region_id, company_name, role_name from named`)]);
    rows = result.rows;
  } catch (error) {
    // The primary key: this person got a company role between the check and the insert.
    if (hasCode(error, "23505")) return { status: "stale" };
    throw error;
  }
  const row = rows[0];
  if (row) return { status: "accepted", companyId: row.company_id, regionId: row.region_id, companyName: row.company_name, roleName: row.role_name };

  // Nothing was written: say which condition stopped it, as the page would have.
  const look = await lookCompanyInvitation(invitationId, { id: person.id, email }, now);
  if (look?.state === "in-company") return { status: "in-company", companyName: look.companyName };
  return !look || look.state === "ready" || look.state === "signed-out" ? { status: "stale" } : { status: look.state };
}
