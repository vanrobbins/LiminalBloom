// Whether the person's access REQUIRES two-factor (a role of theirs with "Requires two-factor" on, in any
// store they belong to), and where: the store's name, for the line that says why Turn off is not offered
// (spec 0.7.1 1, A3b). A company role (owner, corporate admin, regional manager) always requires it
// (DECISIONS 11-23), named by its company. Runs as the table owner (the store role can't read Better Auth's member table).

import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, organization } from "@/db/auth-schema";
import { companies, platformAdmins, roleAssignments, roleDefinitions } from "@/db/schema";

/** The name of a store where this person's role requires two-factor, or null when none does. */
export async function storeRequiringTwoFactor(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: organization.name })
    .from(member)
    .innerJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, userId), eq(roleDefinitions.requiresTwoFactor, true)))
    .orderBy(asc(organization.name))
    .limit(1);
  return row?.name ?? null;
}

/** The name of the company this person owns or holds a role in: every company role requires two-factor. Null when none. */
export async function companyRequiringTwoFactor(userId: string): Promise<string | null> {
  const [owned] = await db.select({ name: companies.name }).from(companies).where(eq(companies.ownerUserId, userId));
  if (owned) return owned.name;
  const [assigned] = await db.select({ name: companies.name }).from(roleAssignments).innerJoin(companies, eq(companies.id, roleAssignments.companyId)).where(eq(roleAssignments.userId, userId)).limit(1);
  return assigned?.name ?? null;
}

/**
 * Why the account must keep a second factor, if it must: it is a Liminal Bloom admin, or a role of theirs requires
 * it. `store` names where: the store, else the company (the Account line reads "Your role in {store} requires...").
 */
export async function twoFactorRequirement(userId: string): Promise<{ isAdmin: boolean; store: string | null }> {
  const [admin, store, company] = await Promise.all([
    db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId)),
    storeRequiringTwoFactor(userId),
    companyRequiringTwoFactor(userId),
  ]);
  return { isAdmin: admin.length > 0, store: store ?? company };
}
