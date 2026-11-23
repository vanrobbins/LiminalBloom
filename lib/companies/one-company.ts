// One company per person (spec 0.7.1 5.4): a person is the owner of a company, holds a role in one, or is a member
// of one of its stores, and only one company at a time. The grant statements (approve, company invitation accept,
// store invitation accept) put `inOtherCompany` in their own WHERE, so the check and the grant are one statement.
// Two grants at the same instant for two companies could both pass: the named, accepted race.

import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";

/** True when `personId` is in a company other than `companyId` (a SQL text expression; null never matches). */
export const inOtherCompany = (personId: SQL, companyId: SQL): SQL => sql`(
  exists (select 1 from companies oc where oc.owner_user_id = ${personId} and oc.id <> ${companyId})
  or exists (select 1 from role_assignments ora where ora.user_id = ${personId} and ora.company_id <> ${companyId})
  or exists (select 1 from member om join store_profiles osp on osp.store_id = om.organization_id where om.user_id = ${personId} and osp.company_id <> ${companyId}))`;

/** The company a person is in other than the one `target` names (a scalar SQL expression), for the refusal's words. */
export async function otherCompanyName(userId: string, target: SQL): Promise<string | null> {
  const { rows } = await db.execute<{ name: string }>(sql`
    select c.name from companies c
    where c.id <> ${target} and (
      c.owner_user_id = ${userId}
      or exists (select 1 from role_assignments ra where ra.user_id = ${userId} and ra.company_id = c.id)
      or exists (select 1 from member m join store_profiles sp on sp.store_id = m.organization_id where m.user_id = ${userId} and sp.company_id = c.id))
    order by c.name limit 1`);
  return rows[0]?.name ?? null;
}

/** The company a store belongs to, as a scalar SQL expression (null for a standalone store). */
export const companyOfStore = (storeId: string): SQL => sql`(select company_id from store_profiles where store_id = ${storeId})`;
