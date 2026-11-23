// Whether the person's access REQUIRES two-factor (a role of theirs with "Requires two-factor" on, in any
// store they belong to), and where: the store's name, for the line that says why Turn off is not offered
// (spec 0.7.1 1, A3b). Runs as the table owner (the store role can't read Better Auth's member table).

import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, organization } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";

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
