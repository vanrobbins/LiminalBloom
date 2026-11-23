// Accepting an invitation (spec 0.7, 4.5 spike findings, 4.8 part 5). Better Auth's
// accept endpoint cannot write our role_id and is closed, so this is the app's own
// write: ONE statement adds the member with the invitation's role, marks the
// invitation accepted and writes the access_events row, so none exists without the
// others. The conditions sit in the statement itself, so two accepts, or an accept
// racing a cancel, cannot both win: the invitation must still be pending and
// unexpired, its role must be one of that store's (the invitation_role_fk foreign key
// already says so; this keeps the member insert from relying on it), its email must be
// this person's, they must not already be in the store, the store must have room, and
// the inviter must still be able to grant the role (invitation-lapse.ts), or the
// invitation has lapsed, and, for a company store, the person must be in no other company (spec 0.7.1 5.4). That check locks the inviter's member row and role row FOR
// SHARE, so a removal or role change still uncommitted when the accept starts is
// waited for and seen; one that commits later is ordered after the accept. The
// invitation's own role row is not locked (invitation-lapse.ts says what that leaves).
//
// The person comes from the action's session (never the browser). Runs as the table
// owner, so every condition is spelled out here.

import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { inOtherCompany, lockPersonGrants } from "@/lib/companies/one-company";

import { lookInvitation, type InvitationState } from "./invitation-look";
import { inviterMayGrant } from "./invitation-lapse";
import { MAX_PEOPLE } from "./invite-limits";

export type AcceptOutcome =
  | { status: "accepted"; storeId: string; storeName: string; roleName: string }
  | { status: Exclude<InvitationState["state"], "ready" | "signed-out" | "in-company"> | "stale" }
  | { status: "in-company"; companyName: string };

export async function acceptInvitation(person: { id: string; name: string; email: string }, invitationId: string, now: Date = new Date()): Promise<AcceptOutcome> {
  const nowText = now.toISOString();
  const email = person.email.trim().toLowerCase();
  // The lock first, in one transaction with the grant: see lockPersonGrants (one-company.ts).
  const [, result] = await db.batch([lockPersonGrants(person.id), db.execute(sql`
    with taken as (
      update invitation i set status = 'accepted'
      where i.id = ${invitationId}::text and i.status = 'pending' and i.expires_at > ${nowText}::timestamp
        and exists (select 1 from role_definitions r where r.store_id = i.organization_id and r.id = i.role_id)
        and lower(i.email) = ${email}::text
        and not exists (select 1 from member m where m.organization_id = i.organization_id and m.user_id = ${person.id}::text)
        and (select count(*) from member m where m.organization_id = i.organization_id) < ${MAX_PEOPLE}
        and not exists (select 1 from store_profiles sp where sp.store_id = i.organization_id and ${inOtherCompany(sql`${person.id}::text`, sql`sp.company_id`)})
        and ${inviterMayGrant(sql`i.organization_id`, sql`i.role_id`, sql`i.inviter_id`, true)}
      returning i.organization_id, i.role_id),
    added as (
      insert into member (id, organization_id, user_id, role, created_at, role_id)
      select ${randomUUID()}::text, t.organization_id, ${person.id}::text, 'member', ${nowText}::timestamp, t.role_id from taken t
      returning organization_id, role_id),
    named as (
      select a.organization_id, r.name as role_name, o.name as store_name
      from added a
      join role_definitions r on r.store_id = a.organization_id and r.id = a.role_id
      join organization o on o.id = a.organization_id),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select organization_id, ${person.id}::text, ${person.name}::text, 'invitation_accepted',
        jsonb_build_object('person', ${person.name}::text, 'email', ${email}::text, 'role', role_name)
      from named
      returning id)
    select organization_id, role_name, store_name from named`)]);

  const [row] = result.rows as { organization_id: string; role_name: string; store_name: string }[];
  if (row) return { status: "accepted", storeId: row.organization_id, storeName: row.store_name, roleName: row.role_name };

  // Nothing was written: say which condition stopped it, as the page would have.
  const look = await lookInvitation(invitationId, { id: person.id, email }, now);
  if (look.state === "in-company") return { status: "in-company", companyName: look.companyName };
  return look.state === "ready" || look.state === "signed-out" ? { status: "stale" } : { status: look.state };
}
