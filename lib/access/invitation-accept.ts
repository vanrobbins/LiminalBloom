// Accepting an invitation (spec 0.7, 4.5 spike findings, 4.8 part 5). Better Auth's
// accept endpoint cannot write our role_id and is closed, so this is the app's own
// write: ONE statement adds the member with the invitation's role, marks the
// invitation accepted and writes the access_events row, so none exists without the
// others. The conditions sit in the statement itself, so two accepts, or an accept
// racing a cancel, cannot both win: the invitation must still be pending and
// unexpired, its role must be one of that store's (the invitation_role_fk foreign key
// already says so; this keeps the member insert from relying on it), its email must be
// this person's, they must not already be in the store, and the store must have room.
//
// The person comes from the action's session (never the browser). Runs as the table
// owner, so every condition is spelled out here.

import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { lookInvitation, type InvitationState } from "./invitation-look";
import { MAX_PEOPLE } from "./invite-limits";

export type AcceptOutcome =
  | { status: "accepted"; storeId: string; storeName: string; roleName: string }
  | { status: Exclude<InvitationState["state"], "ready" | "signed-out"> | "stale" };

export async function acceptInvitation(person: { id: string; name: string; email: string }, invitationId: string, now: Date = new Date()): Promise<AcceptOutcome> {
  const nowText = now.toISOString();
  const email = person.email.trim().toLowerCase();
  const result = await db.execute(sql`
    with taken as (
      update invitation i set status = 'accepted'
      where i.id = ${invitationId}::text and i.status = 'pending' and i.expires_at > ${nowText}::timestamp
        and exists (select 1 from role_definitions r where r.store_id = i.organization_id and r.id = i.role_id)
        and lower(i.email) = ${email}::text
        and not exists (select 1 from member m where m.organization_id = i.organization_id and m.user_id = ${person.id}::text)
        and (select count(*) from member m where m.organization_id = i.organization_id) < ${MAX_PEOPLE}
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
    select organization_id, role_name, store_name from named`);

  const [row] = result.rows as { organization_id: string; role_name: string; store_name: string }[];
  if (row) return { status: "accepted", storeId: row.organization_id, storeName: row.store_name, roleName: row.role_name };

  // Nothing was written: say which condition stopped it, as the page would have.
  const look = await lookInvitation(invitationId, { id: person.id, email }, now);
  return look.state === "ready" || look.state === "signed-out" ? { status: "stale" } : { status: look.state };
}
