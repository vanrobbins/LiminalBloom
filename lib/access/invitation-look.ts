// What the invitation page (/invite/[id]) and /welcome read (spec 0.7, 4.8). Better
// Auth's own invitation reads need a verified email and its list routes are closed
// (spike findings under 4.5), so these are Drizzle reads as the table owner: nothing
// here is scoped by the store role.
//
// The id is the secret (4.9): an invitation is found by its id or by the email it was
// sent to, never listed by store here (the People screen does that, for people.manage).
// A signed-out visitor, and someone with the wrong email, are told the store and role
// at most, never the invited address.

import "server-only";

import { and, desc, eq, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, organization } from "@/db/auth-schema";
import { roleDefinitions, storeSuspensions } from "@/db/schema";
import { lookCompanyInvitation } from "@/lib/companies/invite-look";
import { companyOfStore, otherCompanyName } from "@/lib/companies/one-company";

import { inviterMayGrant } from "./invitation-lapse";
import { MAX_PEOPLE } from "./invite-limits";

export type Viewer = { id: string; email: string };

// One member per state (not one member with a union of states), so checking `state` narrows to the fields it has.
type Named<S extends string> = S extends string ? { state: S; storeName: string; roleName: string } : never;

export type InvitationState =
  | { state: "missing" }
  | { state: "used" }
  | { state: "cancelled" }
  | Named<"expired" | "lapsed" | "signed-out" | "wrong-email" | "already-member" | "full">
  // A company invitation whose company is paused: nothing can be accepted until Liminal Bloom restores it.
  | Named<"company-paused">
  // In a different company (spec 0.7.1 5.4): the refusal names it.
  | (Named<"in-company"> & { companyName: string })
  // Present (true) only when the store, or its company, is paused: they may still accept, but won't see it until it is restored (DECISIONS 11-23).
  | (Named<"ready"> & { paused?: true });

/** The invitation as `viewer` (null: signed out) would find it, as one plain state for the page to word. A company invitation (spec 0.7.1 6.5) is looked up when no store invitation has the id. */
export async function lookInvitation(id: string, viewer: Viewer | null, now: Date = new Date()): Promise<InvitationState> {
  // Ids are 32 to 36 characters; a longer value in the address is not one, so it never reaches the database.
  if (id.length > 200) return { state: "missing" };
  const [row] = await db
    .select({
      storeId: invitation.organizationId,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      storeName: organization.name,
      roleName: roleDefinitions.name,
      paused: sql<boolean>`(exists (select 1 from ${storeSuspensions} where ${storeSuspensions.storeId} = ${invitation.organizationId})
        or exists (select 1 from store_profiles sp join companies pc on pc.id = sp.company_id where sp.store_id = ${invitation.organizationId} and pc.suspended_at is not null))`,
      lapsed: sql<boolean>`not ${inviterMayGrant(invitation.organizationId, invitation.roleId, invitation.inviterId)}`,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, invitation.organizationId), eq(roleDefinitions.id, invitation.roleId)))
    .where(eq(invitation.id, id));
  if (!row) return (await lookCompanyInvitation(id, viewer, now)) ?? { state: "missing" };
  if (row.status === "accepted") return { state: "used" };
  if (row.status === "canceled" || row.status === "rejected") return { state: "cancelled" };
  // An invitation with no role cannot be accepted; none can be made today.
  if (row.status !== "pending" || row.roleName === null) return { state: "missing" };

  const named = { storeName: row.storeName, roleName: row.roleName };
  if (row.expiresAt <= now) return { state: "expired", ...named };
  // Like an expired one, whoever holds the link: the inviter can no longer grant this role.
  if (row.lapsed) return { state: "lapsed", ...named };
  if (!viewer) return { state: "signed-out", ...named };
  if (viewer.email.trim().toLowerCase() !== row.email.trim().toLowerCase()) return { state: "wrong-email", ...named };

  const [people] = await db
    .select({ n: sql<number>`count(*)::int`, you: sql<number>`count(*) filter (where ${member.userId} = ${viewer.id})::int` })
    .from(member)
    .where(eq(member.organizationId, row.storeId));
  if (people.you > 0) return { state: "already-member", ...named };
  // A company store takes only people who are in no other company (spec 0.7.1 5.4).
  const other = await otherCompanyName(viewer.id, companyOfStore(row.storeId));
  if (other) return { state: "in-company", companyName: other, ...named };
  if (people.n >= MAX_PEOPLE) return { state: "full", ...named };
  return { state: "ready", ...named, ...(row.paused ? { paused: true as const } : {}) };
}

// No id: /welcome is open to anyone who signs up with an invited address (email is not verified), and the link is the secret (4.9), so the id never leaves this read.
export type WaitingInvitation = { storeName: string; roleName: string; /** ISO text, so it crosses into client components. */ expiresAt: string };

/** The invitations waiting for this person's email, newest first, for stores they are not already in. */
export async function pendingInvitationsFor(person: Viewer, now: Date = new Date()): Promise<WaitingInvitation[]> {
  const rows = await db
    .select({ storeName: organization.name, roleName: roleDefinitions.name, expiresAt: invitation.expiresAt })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(roleDefinitions, and(eq(roleDefinitions.storeId, invitation.organizationId), eq(roleDefinitions.id, invitation.roleId)))
    .where(
      and(
        sql`lower(${invitation.email}) = ${person.email.trim().toLowerCase()}`,
        eq(invitation.status, "pending"),
        sql`${invitation.expiresAt} > ${now.toISOString()}::timestamp`,
        inviterMayGrant(invitation.organizationId, invitation.roleId, invitation.inviterId),
        notExists(db.select({ one: sql`1` }).from(member).where(and(eq(member.organizationId, invitation.organizationId), eq(member.userId, person.id)))),
      ),
    )
    .orderBy(desc(invitation.createdAt));
  return rows.map((r) => ({ storeName: r.storeName, roleName: r.roleName, expiresAt: r.expiresAt.toISOString() }));
}
