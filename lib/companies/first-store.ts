// The store a new company person starts in (spec 0.7.1 6.5): the company's first store by name, or the region's
// first for a regional manager, skipping a paused one (a paused store never resolves). Null when there is none
// yet; the person then lands on /company. setActiveStore checks the person reaches it before writing anything.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

export async function firstCompanyStore(companyId: string, regionId: string | null): Promise<string | null> {
  const { rows } = await db.execute<{ id: string }>(sql`
    select o.id from store_profiles sp join organization o on o.id = sp.store_id
    where sp.company_id = ${companyId} and (${regionId}::text is null or sp.region_id = ${regionId}::text)
      and not exists (select 1 from store_suspensions s where s.store_id = sp.store_id)
    order by lower(o.name), o.id limit 1`);
  return rows[0]?.id ?? null;
}
