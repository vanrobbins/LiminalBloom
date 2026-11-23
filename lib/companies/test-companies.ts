// Setup for database tests that need a company: an owner, a company, regions. Rows are written as
// the owner, which row-level security does not restrict. Remove in this order: `dropStores` (a
// company with a store profile cannot be deleted), `dropCompanies`, then `dropPeople` (an owner's
// account cannot be deleted while it owns a company).

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { companies, regions } from "@/db/schema";
import { makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";

const made: string[] = [];

/** A throwaway account: a person in a throwaway store, which `dropStores` and `dropPeople` remove. */
export async function makeAccount(label: string): Promise<string> {
  return (await makePerson((await makeStoreWithRoles(label)).store, null)).userId;
}

/** A company with its own new owner. Returns both ids. */
export async function makeCompany(label: string): Promise<{ id: string; ownerId: string }> {
  const ownerId = await makeAccount(`${label}-owner`);
  const [row] = await db
    .insert(companies)
    .values({ name: `Test company ${label}`, slug: `test-co-${label}-${randomUUID().slice(0, 8)}`, ownerUserId: ownerId })
    .returning({ id: companies.id });
  made.push(row.id);
  return { id: row.id, ownerId };
}

export async function makeRegion(companyId: string, name: string): Promise<string> {
  const [row] = await db.insert(regions).values({ companyId, name }).returning({ id: regions.id });
  return row.id;
}

/** Removes the companies made above, with their regions, roles, invitations and events (all cascade). */
export async function dropCompanies(): Promise<void> {
  if (made.length === 0) return;
  await db.delete(companies).where(inArray(companies.id, made.splice(0)));
}
