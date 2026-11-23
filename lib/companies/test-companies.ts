// Setup for database tests that need a company: an owner, a company, regions. Rows are written as
// the owner, which row-level security does not restrict. Remove in this order: `dropStores` (a
// company with a store profile cannot be deleted), `dropCompanies`, then `dropPeople` (an owner's
// account cannot be deleted while it owns a company).

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { companies, regions, roleAssignments, storeProfiles } from "@/db/schema";
import { makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";

const made: string[] = [];
const bare: string[] = [];

/** A throwaway account: a person in a throwaway store, which `dropStores` and `dropPeople` remove. */
export async function makeAccount(label: string): Promise<string> {
  return (await makePerson((await makeStoreWithRoles(label)).store, null)).userId;
}

/** A company with its own new owner (or `owner`, e.g. a `makeBareAccount`). Returns both ids. */
export async function makeCompany(label: string, owner?: string): Promise<{ id: string; ownerId: string }> {
  const ownerId = owner ?? (await makeAccount(`${label}-owner`));
  const [row] = await db
    .insert(companies)
    .values({ name: `Test company ${label}`, slug: `test-co-${label}-${randomUUID().slice(0, 8)}`, ownerUserId: ownerId })
    .returning({ id: companies.id });
  made.push(row.id);
  return { id: row.id, ownerId };
}

/** An account in no store at all, for a company person who reaches only what the company gives them. Removed by `dropCompanies`. */
export async function makeBareAccount(label: string): Promise<string> {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  await db.insert(user).values({ id, name: `Test ${label}`, email: `${id}@example.com`, twoFactorEnabled: true });
  bare.push(id);
  return id;
}

/** A store with its five roles that belongs to the company (and to a region, or none). Removed by `dropStores`. */
export async function makeCompanyStore(companyId: string, regionId: string | null, label: string) {
  const made = await makeStoreWithRoles(label);
  await db.insert(storeProfiles).values({ storeId: made.store, companyId, regionId });
  return made;
}

/** Gives a person the company role (the owner is a column on the company, not a row). */
export async function assignCompanyRole(companyId: string, userId: string, role: "corporate_admin" | "regional_manager", regionId: string | null = null): Promise<void> {
  await db.insert(roleAssignments).values({ companyId, userId, role, regionId });
}

export async function makeRegion(companyId: string, name: string): Promise<string> {
  const [row] = await db.insert(regions).values({ companyId, name }).returning({ id: regions.id });
  return row.id;
}

/** The address a test account was made with. */
export async function emailOf(userId: string): Promise<string> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  return row.email;
}

/** A company with its owner, a corporate admin and a regional manager (North), who are in no store; a South region too. */
export async function makeStaffedCompany(label: string) {
  const company = await makeCompany(label, await makeBareAccount(`${label}-owner`));
  const north = await makeRegion(company.id, "North");
  const south = await makeRegion(company.id, "South");
  const admin = await makeBareAccount(`${label}-admin`);
  const manager = await makeBareAccount(`${label}-rm`);
  await assignCompanyRole(company.id, admin, "corporate_admin");
  await assignCompanyRole(company.id, manager, "regional_manager", north);
  return { company, north, south, owner: company.ownerId, admin, manager };
}

/** Removes the companies made above, with their regions, roles, invitations and events (all cascade). */
export async function dropCompanies(): Promise<void> {
  if (made.length > 0) await db.delete(companies).where(inArray(companies.id, made.splice(0)));
  if (bare.length > 0) await db.delete(user).where(inArray(user.id, bare.splice(0)));
}
