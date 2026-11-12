// Inviting someone into a store (spec 0.7, 4.8 part 5 and 4.9). Better Auth's invite
// endpoint refuses anyone who is not its own owner or admin and knows nothing of our
// roles (spike findings under 4.5), so this is the app's own write to `invitation`.
// No email is sent: the id is the link, and the id is the secret (4.9), so it is a
// long random value, shown only to someone who may act on the invitation.
//
// The checks and the write are ONE statement (like people-write.ts): the invitation
// and its access_events row exist together or not at all, and a duplicate that
// appeared after the reads below is still caught. Two requests at the very same
// instant can both pass (there is no unique index to stop them, and adding one is a
// migration): the cost is a second link for one address. Counts and "already
// waiting" ignore an expired invitation, and a lapsed one (its inviter can no longer
// grant its role, invitation-lapse.ts): it is dead, and People offers Cancel only. A
// lapsed invitation is a live condition (it revives if its inviter regains the authority),
// so a new invitation to the same address cancels the lapsed one in the same statement:
// there is never a usable one beside a lapsed one.
//
// Runs as the table owner, not through withStore (the store role cannot reach Better
// Auth's tables), so every statement is filtered by the store id by hand.

import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";

import { canActOn } from "./rank";
import { changedRows, stillRanked, type PeopleActor } from "./people-write";

import { inviterMayGrant } from "./invitation-lapse";
import { INVITATION_HOURS, MAX_INVITATIONS, MAX_PEOPLE } from "./invite-limits";

// Also here, so the server code and its tests have one place to import from.
export { INVITATION_HOURS, MAX_INVITATIONS, MAX_PEOPLE };

export type InviteOutcome =
  | { status: "created"; id: string; email: string; roleName: string; expiresAt: Date }
  | { status: "already-member"; name: string }
  | { status: "bad-email" | "forbidden" | "invalid" | "already-invited" | "people-full" | "invitations-full" };

const emailSchema = z.email().max(254);

/** The address as stored: trimmed and lowercase (Better Auth does the same). Null when it isn't one. */
export function cleanEmail(raw: string): string | null {
  const parsed = emailSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

/** An invitation in the statements below whose inviter can still grant its role: a lapsed one is dead, like an expired one. */
const notLapsed = inviterMayGrant(sql`invitation.organization_id`, sql`invitation.role_id`, sql`invitation.inviter_id`);

/** 192 random bits: the link works for whoever holds it, so it must not be guessable. */
const newInvitationId = () => randomBytes(24).toString("base64url");

export async function createInvitation(storeId: string, actor: PeopleActor, rawEmail: string, roleId: string, now: Date = new Date()): Promise<InviteOutcome> {
  const email = cleanEmail(rawEmail);
  if (!email) return { status: "bad-email" };
  const [role] = await db
    .select({ id: roleDefinitions.id, name: roleDefinitions.name, rank: roleDefinitions.rank })
    .from(roleDefinitions)
    .where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.id, roleId)));
  if (!role) return { status: "invalid" };
  if (!canActOn(actor, role.rank, "people.manage")) return { status: "forbidden" };
  return applyInvitation(storeId, actor, email, role, now);
}

/** The write alone, after the checks above; exported so a test can run it when a check's answer has changed since. */
export async function applyInvitation(storeId: string, actor: PeopleActor, email: string, role: { id: string; name: string; rank: number }, now: Date): Promise<InviteOutcome> {
  const id = newInvitationId();
  const nowText = now.toISOString();
  const expiresAt = new Date(now.getTime() + INVITATION_HOURS * 3_600_000);
  const detail = JSON.stringify({ email, role: role.name });
  const written = await changedRows(sql`
    with allowed as (
      select 1 where
        ${stillRanked(storeId, role.id, role.rank)}
        and not exists (select 1 from member m join "user" u on u.id = m.user_id where m.organization_id = ${storeId} and lower(u.email) = ${email}::text)
        and not exists (select 1 from invitation where organization_id = ${storeId} and lower(email) = ${email}::text and status = 'pending' and expires_at > ${nowText}::timestamp and ${notLapsed})
        and (select count(*) from member where organization_id = ${storeId}) < ${MAX_PEOPLE}
        and (select count(*) from invitation where organization_id = ${storeId} and status = 'pending' and expires_at > ${nowText}::timestamp and ${notLapsed}) < ${MAX_INVITATIONS}),
    superseded as (
      update invitation set status = 'canceled'
      where organization_id = ${storeId} and lower(email) = ${email}::text and status = 'pending' and expires_at > ${nowText}::timestamp and not ${notLapsed}
        and exists (select 1 from allowed)
      returning id),
    made as (
      insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id, role_id)
      select ${id}::text, ${storeId}::text, ${email}::text, 'member', 'pending', ${expiresAt.toISOString()}::timestamp, ${actor.userId}::text, ${role.id}::text from allowed
      returning id)
    insert into access_events (store_id, actor_id, actor_name, event, detail)
    select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, 'invitation_created', ${detail}::jsonb from made
    returning id`);
  if (written > 0) return { status: "created", id, email, roleName: role.name, expiresAt };
  return whyNotInvited(storeId, email, now, role);
}

/** After the statement wrote nothing: which of its checks stopped it, in the order the dialog lists them. */
async function whyNotInvited(storeId: string, email: string, now: Date, role: { id: string; rank: number }): Promise<InviteOutcome> {
  // A role deleted or moved since the check makes the dialog stale, whatever else is true.
  const [ranked] = await db.select({ id: roleDefinitions.id }).from(roleDefinitions).where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.id, role.id), eq(roleDefinitions.rank, role.rank)));
  if (!ranked) return { status: "invalid" };
  const [there] = await db
    .select({ name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, storeId), sql`lower(${user.email}) = ${email}`));
  if (there) return { status: "already-member", name: there.name };
  const waiting = and(eq(invitation.organizationId, storeId), eq(invitation.status, "pending"), sql`${invitation.expiresAt} > ${now.toISOString()}::timestamp`, inviterMayGrant(invitation.organizationId, invitation.roleId, invitation.inviterId));
  const [duplicate] = await db.select({ id: invitation.id }).from(invitation).where(and(waiting, sql`lower(${invitation.email}) = ${email}`));
  if (duplicate) return { status: "already-invited" };
  const [people] = await db.select({ n: sql<number>`count(*)::int` }).from(member).where(eq(member.organizationId, storeId));
  if (people.n >= MAX_PEOPLE) return { status: "people-full" };
  return { status: "invitations-full" };
}
