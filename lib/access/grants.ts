// What a person is granted, read from the database (spec 0.7.1, 4.2): their `member` rows with the role each
// holds, their one company role if any, and the stores that role reaches. lib/access/resolve-merge.ts turns it
// into access. Read as the table owner (the store role cannot read Better Auth's tables or the company
// tables), so every query is filtered by hand, by user id or company id.
//
// A paused store never resolves, and neither does any store of a paused company: both filters sit in the
// queries, so nothing downstream can forget them. A paused company also drops the company role itself.
//
// Deliberately without `import "server-only"`: lib/active-store.ts uses this and lib/auth.ts imports that,
// and the Better Auth CLI loads lib/auth.ts outside Next.js.

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { member, organization, user } from "@/db/auth-schema";
import { companies, regions, roleAssignments, roleDefinitions, storeProfiles, storeSuspensions } from "@/db/schema";

import type { CompanyGrant, Grants, MemberGrant, StoreInfo } from "./resolve-merge";
import { BUILTIN_ROLES, type BuiltinRoleKey } from "./roles";

function builtinKey(stored: string | null): BuiltinRoleKey | null {
  return BUILTIN_ROLES.find((r) => r.key === stored)?.key ?? null;
}

/**
 * The person's `member` rows. The role is joined on both the store id and the role id (the composite foreign
 * key keeps them consistent; the join does not rely on that); Better Auth's own `member.role` is never read.
 */
async function memberGrants(userId: string): Promise<MemberGrant[]> {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      joinedAt: member.createdAt,
      companyId: storeProfiles.companyId,
      companyName: companies.name,
      regionId: storeProfiles.regionId,
      regionName: regions.name,
      roleId: roleDefinitions.id,
      roleName: roleDefinitions.name,
      rank: roleDefinitions.rank,
      builtin: roleDefinitions.builtin,
      stored: roleDefinitions.switches,
      requiresTwoFactor: roleDefinitions.requiresTwoFactor,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
    .leftJoin(storeProfiles, eq(storeProfiles.storeId, member.organizationId))
    .leftJoin(companies, eq(companies.id, storeProfiles.companyId))
    .leftJoin(regions, eq(regions.id, storeProfiles.regionId))
    .leftJoin(storeSuspensions, eq(storeSuspensions.storeId, member.organizationId))
    .where(and(eq(member.userId, userId), isNull(storeSuspensions.storeId), isNull(companies.suspendedAt)));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    companyId: r.companyId,
    companyName: r.companyName,
    regionId: r.regionId,
    regionName: r.regionName,
    joinedAt: r.joinedAt,
    role:
      r.roleId === null || r.roleName === null || r.rank === null
        ? null
        : { id: r.roleId, name: r.roleName, rank: r.rank, builtin: builtinKey(r.builtin), stored: r.stored, requiresTwoFactor: r.requiresTwoFactor ?? false },
  }));
}

/** The person's company role: the company they own, else their one `role_assignments` row. Null while the company is paused. */
async function companyGrant(userId: string): Promise<CompanyGrant | null> {
  const [owned] = await db
    .select({ companyId: companies.id, companyName: companies.name })
    .from(companies)
    .where(and(eq(companies.ownerUserId, userId), isNull(companies.suspendedAt)));
  if (owned) return { ...owned, role: "owner", regionId: null, regionName: null };

  const [assigned] = await db
    .select({ companyId: companies.id, companyName: companies.name, role: roleAssignments.role, regionId: roleAssignments.regionId, regionName: regions.name })
    .from(roleAssignments)
    .innerJoin(companies, eq(companies.id, roleAssignments.companyId))
    .leftJoin(regions, eq(regions.id, roleAssignments.regionId))
    .where(and(eq(roleAssignments.userId, userId), isNull(companies.suspendedAt)));
  return assigned ?? null;
}

/** The stores a company role reaches. A regional manager's is only the stores whose region is theirs. */
async function companyStoresOf(grant: CompanyGrant): Promise<StoreInfo[]> {
  // A regional manager with no region cannot exist (the table's check); if it did, it reaches nothing.
  if (grant.role === "regional_manager" && !grant.regionId) return [];
  const inRegion = grant.role === "regional_manager" && grant.regionId ? eq(storeProfiles.regionId, grant.regionId) : undefined;
  const rows = await db
    .select({ id: organization.id, name: organization.name, regionId: storeProfiles.regionId, regionName: regions.name })
    .from(storeProfiles)
    .innerJoin(organization, eq(organization.id, storeProfiles.storeId))
    .leftJoin(regions, eq(regions.id, storeProfiles.regionId))
    .leftJoin(storeSuspensions, eq(storeSuspensions.storeId, storeProfiles.storeId))
    .where(and(eq(storeProfiles.companyId, grant.companyId), isNull(storeSuspensions.storeId), inRegion));
  return rows.map((r) => ({ ...r, companyId: grant.companyId, companyName: grant.companyName }));
}

async function lastActiveStoreOf(userId: string): Promise<string | null> {
  const [row] = await db.select({ id: user.lastActiveStoreId }).from(user).where(eq(user.id, userId));
  return row?.id ?? null;
}

/** Everything resolveAccess and the sign-in choice need, read afresh on each call. */
export async function readGrants(userId: string): Promise<Grants> {
  const [members, company, lastActiveStoreId] = await Promise.all([memberGrants(userId), companyGrant(userId), lastActiveStoreOf(userId)]);
  return { members, company, companyStores: company ? await companyStoresOf(company) : [], lastActiveStoreId };
}
