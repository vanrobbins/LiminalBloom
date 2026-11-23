// What /company shows about the company (spec 0.7.1 6.2): its name and owner, its regions with their counts, and
// its stores with the region each sits in. Read as the table owner with the company id from the person's own
// access, never the browser. A regional manager sees only their region and its stores.

import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { organization, user } from "@/db/auth-schema";
import { companies, regions, storeProfiles, storeSuspensions } from "@/db/schema";
import type { CompanyAccess } from "@/lib/access/resolve-merge";

export type RegionRow = { id: string; name: string; stores: number; managers: number };
export type CompanyStoreRow = { id: string; name: string; regionId: string | null; regionName: string | null; paused: boolean };
export type CompanyView = { name: string; ownerName: string; regions: RegionRow[]; stores: CompanyStoreRow[] };

export async function companyView(company: CompanyAccess): Promise<CompanyView> {
  // A regional manager's whole view is their region.
  const own = company.role === "regional_manager" ? company.regionId : null;
  const scoped = company.role === "regional_manager";
  const [[head], regionRows, storeRows] = await Promise.all([
    db.select({ name: companies.name, ownerName: user.name }).from(companies).innerJoin(user, eq(user.id, companies.ownerUserId)).where(eq(companies.id, company.id)),
    db
      .select({
        id: regions.id,
        name: regions.name,
        stores: sql<number>`(select count(*)::int from store_profiles sp where sp.region_id = ${regions.id})`,
        managers: sql<number>`(select count(*)::int from role_assignments ra where ra.region_id = ${regions.id})`,
      })
      .from(regions)
      .where(and(eq(regions.companyId, company.id), scoped ? eq(regions.id, own ?? "") : undefined))
      .orderBy(asc(sql`lower(${regions.name})`)),
    db
      .select({ id: organization.id, name: organization.name, regionId: storeProfiles.regionId, regionName: regions.name, paused: sql<boolean>`${storeSuspensions.storeId} is not null` })
      .from(storeProfiles)
      .innerJoin(organization, eq(organization.id, storeProfiles.storeId))
      .leftJoin(regions, eq(regions.id, storeProfiles.regionId))
      .leftJoin(storeSuspensions, eq(storeSuspensions.storeId, storeProfiles.storeId))
      .where(and(eq(storeProfiles.companyId, company.id), scoped ? eq(storeProfiles.regionId, own ?? "") : undefined))
      .orderBy(asc(sql`lower(${organization.name})`)),
  ]);
  return { name: head?.name ?? company.name, ownerName: head?.ownerName ?? "", regions: regionRows, stores: storeRows };
}
