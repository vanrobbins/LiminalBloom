// Renaming a company (spec 0.7.1 6.2 Details), as renameStore does for a store: ONE statement changes the name
// and inserts its company_events row, pinned to the name the person saw, so a rename made elsewhere meanwhile
// changes nothing and answers "stale". The slug is not touched.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { logCompanyEvent, type CompanyActor } from "./events";
import { cleanCompanyName } from "./limits";

export type RenameCompanyOutcome = { status: "renamed" | "stale" | "invalid" | "unchanged" };

export async function renameCompany(companyId: string, actor: CompanyActor, seenName: string, rawName: string): Promise<RenameCompanyOutcome> {
  const name = cleanCompanyName(rawName);
  if (name === null) return { status: "invalid" };
  if (name === seenName) return { status: "unchanged" };
  const done = await db.execute(sql`
    with renamed as (
      update companies c set name = ${name}, version = c.version + 1, updated_at = now()
      from companies old
      where c.id = ${companyId} and old.id = c.id and c.name = ${seenName}
      returning old.name as old_name, c.name as new_name),
    logged as (${logCompanyEvent(companyId, actor, "company_renamed", "renamed", sql`jsonb_build_object('from', r.old_name, 'to', r.new_name)`)})
    select id from logged`);
  return { status: done.rows.length === 1 ? "renamed" : "stale" };
}
