// The people lookup on /admin/people (spec 0.7.1 7.3): one account by its exact email, with what an admin
// needs to help them. Account facts only, as ./reads.ts. Secrets (password hash, two-factor secret, session
// tokens) are never selected: the shapes below are what is sent to the page.

import "server-only";

import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, organization, passkey, session, user } from "@/db/auth-schema";
import { platformAdmins, roleDefinitions, storeSuspensions } from "@/db/schema";

export type PersonStore = { id: string; name: string; roleName: string | null; paused: boolean };
export type PersonInvitation = { id: string; storeId: string; storeName: string; roleName: string | null; expiresAt: Date; expired: boolean };
export type PersonLookup = {
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
  twoFactorEnabled: boolean;
  passkeys: number;
  /** Sessions that have not expired. */
  sessions: number;
  isAdmin: boolean;
  stores: PersonStore[];
  invitations: PersonInvitation[];
};

/** The email as stored: Better Auth lowercases addresses, so the lookup does too. */
export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export async function lookupPerson(rawEmail: string, now: Date = new Date()): Promise<PersonLookup | null> {
  const email = normalizeEmail(rawEmail);
  if (email === "") return null;
  const [found] = await db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.email, email));
  if (!found) return null;

  const [[sessions], [passkeys], [admin], stores, invitations] = await Promise.all([
    db.select({ n: count() }).from(session).where(and(eq(session.userId, found.id), gt(session.expiresAt, now))),
    db.select({ n: count() }).from(passkey).where(eq(passkey.userId, found.id)),
    db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, found.id)),
    db
      .select({ id: organization.id, name: organization.name, roleName: roleDefinitions.name, paused: storeSuspensions.storeId })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
      .leftJoin(storeSuspensions, eq(storeSuspensions.storeId, organization.id))
      .where(eq(member.userId, found.id))
      .orderBy(asc(organization.name)),
    db
      .select({ id: invitation.id, storeId: organization.id, storeName: organization.name, roleName: roleDefinitions.name, expiresAt: invitation.expiresAt })
      .from(invitation)
      .innerJoin(organization, eq(organization.id, invitation.organizationId))
      .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, invitation.organizationId), eq(roleDefinitions.id, invitation.roleId)))
      .where(and(sql`lower(${invitation.email}) = ${email}`, eq(invitation.status, "pending")))
      .orderBy(desc(invitation.createdAt)),
  ]);

  return {
    userId: found.id,
    name: found.name,
    email: found.email,
    createdAt: found.createdAt,
    twoFactorEnabled: found.twoFactorEnabled === true,
    passkeys: passkeys.n,
    sessions: sessions.n,
    isAdmin: admin !== undefined,
    stores: stores.map((s) => ({ ...s, paused: s.paused !== null })),
    invitations: invitations.map((i) => ({ ...i, expired: i.expiresAt <= now })),
  };
}
