// What the company admin screens read (spec 0.7.1 7.3): one row per company with its counts, and one company's facts,
// corporate admins, regions, stores and waiting invitations. Names, emails, roles, counts and dates only (spec 7.6).
// Runs as the table owner, like ./reads.ts, so every query filters by the ids it is given. Nothing here authorises:
// each page calls requirePlatformAdmin() first.

import "server-only";

import { and, asc, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import { organization, user } from "@/db/auth-schema";
import { companies, companyInvitations, regions, roleAssignments, storeProfiles, storeSuspensions } from "@/db/schema";

type Row = Record<string, unknown>;

export const MAX_COMPANIES = 500;

/**
 * Everyone in a company, one row per person: its owner, its role holders and the members of its stores. `k` is the
 * companies row the caller is about (aliased, so the inner tables cannot shadow it).
 */
const peopleOf = (companyId: SQL) => sql`select k.owner_user_id as uid from companies k where k.id = ${companyId}
  union select ra.user_id from role_assignments ra where ra.company_id = ${companyId}
  union select m.user_id from member m join store_profiles sp on sp.store_id = m.organization_id where sp.company_id = ${companyId}`;

export type CompanyRow = { id: string; name: string; ownerName: string; corporateAdmins: string[]; regions: number; stores: number; people: number; createdAt: Date; paused: boolean };

/** Every company, by name (the first 500; `truncated` says there are more), with its owner, corporate admins and counts. */
export async function listCompanies(): Promise<{ companies: CompanyRow[]; truncated: boolean }> {
  const { rows } = await db.execute<Row>(sql`
    select c.id, c.name, c.created_at, c.suspended_at, u.name as owner_name,
      (select count(*)::int from regions r where r.company_id = c.id) as regions,
      (select count(*)::int from store_profiles sp where sp.company_id = c.id) as stores,
      (select count(*)::int from (${peopleOf(sql`c.id`)}) p) as people
    from companies c join "user" u on u.id = c.owner_user_id
    order by c.name asc, c.id asc
    limit ${MAX_COMPANIES + 1}`);
  const truncated = rows.length > MAX_COMPANIES;
  const list = rows.slice(0, MAX_COMPANIES);
  const ids = list.map((r) => String(r.id));
  const admins =
    ids.length === 0
      ? []
      : await db
          .select({ companyId: roleAssignments.companyId, name: user.name })
          .from(roleAssignments)
          .innerJoin(user, eq(user.id, roleAssignments.userId))
          .where(and(eq(roleAssignments.role, "corporate_admin"), inArray(roleAssignments.companyId, ids)))
          .orderBy(asc(user.name));
  const adminsOf = new Map<string, string[]>();
  for (const a of admins) adminsOf.set(a.companyId, [...(adminsOf.get(a.companyId) ?? []), a.name]);
  return {
    companies: list.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      ownerName: String(r.owner_name),
      corporateAdmins: adminsOf.get(String(r.id)) ?? [],
      regions: Number(r.regions),
      stores: Number(r.stores),
      people: Number(r.people),
      createdAt: new Date(r.created_at as string | Date),
      paused: r.suspended_at !== null,
    })),
    truncated,
  };
}

export type CompanyAdmin = { userId: string; name: string; email: string };
export type CompanyRegion = { id: string; name: string; stores: number };
export type CompanyStore = { id: string; name: string; region: string | null; paused: boolean };
export type CompanyInvitationRow = { id: string; email: string; role: string; region: string | null; expiresAt: Date; expired: boolean };
export type CompanyDetail = {
  id: string;
  name: string;
  version: number;
  createdAt: Date;
  owner: { userId: string; name: string; email: string };
  pause: { reason: string; byName: string; since: Date } | null;
  people: number;
  corporateAdmins: CompanyAdmin[];
  regions: CompanyRegion[];
  stores: CompanyStore[];
  invitations: CompanyInvitationRow[];
};

/** One company's facts, or null when there is no such company. */
export async function companyDetail(companyId: string, now: Date = new Date()): Promise<CompanyDetail | null> {
  const [co] = await db
    .select({
      id: companies.id,
      name: companies.name,
      version: companies.version,
      createdAt: companies.createdAt,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      suspendedAt: companies.suspendedAt,
      suspendedReason: companies.suspendedReason,
      suspendedByName: companies.suspendedByName,
    })
    .from(companies)
    .innerJoin(user, eq(user.id, companies.ownerUserId))
    .where(eq(companies.id, companyId));
  if (!co) return null;
  const [admins, regionRows, storeRows, invites, people] = await Promise.all([
    db
      .select({ userId: user.id, name: user.name, email: user.email })
      .from(roleAssignments)
      .innerJoin(user, eq(user.id, roleAssignments.userId))
      .where(and(eq(roleAssignments.companyId, companyId), eq(roleAssignments.role, "corporate_admin")))
      .orderBy(asc(user.name)),
    db
      .select({ id: regions.id, name: regions.name, stores: count(storeProfiles.storeId) })
      .from(regions)
      .leftJoin(storeProfiles, eq(storeProfiles.regionId, regions.id))
      .where(eq(regions.companyId, companyId))
      .groupBy(regions.id, regions.name)
      .orderBy(asc(regions.name)),
    db
      .select({ id: organization.id, name: organization.name, region: regions.name, paused: storeSuspensions.storeId })
      .from(storeProfiles)
      .innerJoin(organization, eq(organization.id, storeProfiles.storeId))
      .leftJoin(regions, eq(regions.id, storeProfiles.regionId))
      .leftJoin(storeSuspensions, eq(storeSuspensions.storeId, storeProfiles.storeId))
      .where(eq(storeProfiles.companyId, companyId))
      .orderBy(asc(organization.name)),
    db
      .select({ id: companyInvitations.id, email: companyInvitations.email, role: companyInvitations.role, region: regions.name, expiresAt: companyInvitations.expiresAt })
      .from(companyInvitations)
      .leftJoin(regions, and(eq(regions.companyId, companyInvitations.companyId), eq(regions.id, companyInvitations.regionId)))
      .where(and(eq(companyInvitations.companyId, companyId), eq(companyInvitations.status, "pending")))
      .orderBy(desc(companyInvitations.createdAt)),
    db.execute<{ people: number }>(sql`select count(*)::int as people from (${peopleOf(sql`${companyId}::text`)}) p`).then((r) => r.rows),
  ]);
  return {
    id: co.id,
    name: co.name,
    version: co.version,
    createdAt: co.createdAt,
    owner: { userId: co.ownerId, name: co.ownerName, email: co.ownerEmail },
    pause: co.suspendedAt ? { reason: co.suspendedReason ?? "", byName: co.suspendedByName ?? "Liminal Bloom", since: co.suspendedAt } : null,
    people: Number(people[0]?.people ?? 0),
    corporateAdmins: admins,
    regions: regionRows,
    stores: storeRows.map((s) => ({ ...s, paused: s.paused !== null })),
    invitations: invites.map((i) => ({ ...i, expired: i.expiresAt <= now })),
  };
}
