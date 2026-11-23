// Regions and where a store sits (spec 0.7.1 6.3), as the table owner with the company id filtered by hand: the
// action's guard (company.structure) supplies it from the session, never the browser. Each change is ONE
// statement that also inserts its company_events row from RETURNING.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { inviterMayGrantCompany } from "./authority";
import { logCompanyEvent, type CompanyActor } from "./events";
import { cleanRegionName } from "./limits";

const hasCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && (("code" in error && error.code === code) || ("cause" in error && hasCode(error.cause, code)));
const isUnique = (error: unknown): boolean => hasCode(error, "23505");

export type RegionOutcome = { status: "added" | "renamed" | "deleted" | "unchanged" | "invalid" | "taken" | "stale" | "used" | "gone" };

export async function addRegion(companyId: string, actor: CompanyActor, rawName: string): Promise<RegionOutcome> {
  const name = cleanRegionName(rawName);
  if (name === null) return { status: "invalid" };
  try {
    const done = await db.execute(sql`
      with added as (insert into regions (company_id, name) values (${companyId}, ${name}) returning id, name),
      logged as (${logCompanyEvent(companyId, actor, "region_added", "added", sql`jsonb_build_object('name', r.name)`)})
      select id from logged`);
    return { status: done.rows.length === 1 ? "added" : "gone" };
  } catch (error) {
    if (isUnique(error)) return { status: "taken" };
    throw error;
  }
}

/** Pinned to the version the page showed, so a rename made elsewhere meanwhile is "stale", never overwritten. */
export async function renameRegion(companyId: string, actor: CompanyActor, regionId: string, seen: { name: string; version: number }, rawName: string): Promise<RegionOutcome> {
  const name = cleanRegionName(rawName);
  if (name === null) return { status: "invalid" };
  if (name === seen.name) return { status: "unchanged" };
  try {
    const done = await db.execute(sql`
      with renamed as (
        update regions g set name = ${name}, version = g.version + 1, updated_at = now()
        from regions old
        where g.id = ${regionId} and g.company_id = ${companyId} and old.id = g.id and g.version = ${seen.version}
        returning old.name as old_name, g.name as new_name),
      logged as (${logCompanyEvent(companyId, actor, "region_renamed", "renamed", sql`jsonb_build_object('from', r.old_name, 'to', r.new_name)`)})
      select id from logged`);
    return { status: done.rows.length === 1 ? "renamed" : "stale" };
  } catch (error) {
    if (isUnique(error)) return { status: "taken" };
    throw error;
  }
}

/**
 * Only an empty region goes: no store in it and no regional manager or live waiting invitation naming it. The
 * manager half is also the role_assignments foreign key's; the store half is here, because store_profiles sets
 * null (a store moved in at the same instant would drop to "No region": accepted, harmless). Old invitations
 * (accepted, canceled) and dead pending ones (expired, or lapsed because their inviter lost the authority: the
 * rule invite accept uses, authority.ts) that name the region go with it, or their key would stop the delete
 * forever; companyPeople hides the dead ones from the owner, so they must not block either.
 */
export async function deleteRegion(companyId: string, actor: CompanyActor, regionId: string): Promise<RegionOutcome> {
  const live = sql`(ci.status = 'pending' and ci.expires_at > now() and ${inviterMayGrantCompany(sql`ci.company_id`, sql`ci.role`, sql`ci.inviter_id`)})`;
  const empty = sql`not exists (select 1 from store_profiles sp where sp.region_id = ${regionId})
    and not exists (select 1 from role_assignments ra where ra.region_id = ${regionId})
    and not exists (select 1 from company_invitations ci where ci.region_id = ${regionId} and ${live})`;
  const done = await db.execute(sql`
    with old_invitations as (
      delete from company_invitations ci where ci.region_id = ${regionId} and ci.company_id = ${companyId} and not ${live}
        and exists (select 1 from regions g where g.id = ${regionId} and ${empty})
      returning 1),
    gone as (
      delete from regions g where g.id = ${regionId} and g.company_id = ${companyId} and ${empty}
      returning g.name),
    logged as (${logCompanyEvent(companyId, actor, "region_deleted", "gone", sql`jsonb_build_object('name', r.name)`)})
    select id from logged`);
  if (done.rows.length === 1) return { status: "deleted" };
  const exists = await db.execute(sql`select 1 from regions where id = ${regionId} and company_id = ${companyId}`);
  return { status: exists.rows.length === 1 ? "used" : "gone" };
}

export type MoveOutcome = { status: "moved" | "unchanged" | "gone" };

/** Moves a store of this company to a region of this company, or to none (`regionId` null). */
export async function moveStore(companyId: string, actor: CompanyActor, storeId: string, regionId: string | null): Promise<MoveOutcome> {
  const target = regionId === null ? sql`true` : sql`exists (select 1 from regions where id = ${regionId} and company_id = ${companyId})`;
  let done;
  try {
    done = await db.execute(sql`
    with moved as (
      update store_profiles sp set region_id = ${regionId}::text, version = sp.version + 1, updated_at = now()
      from store_profiles old
      where sp.store_id = ${storeId} and sp.company_id = ${companyId} and old.store_id = sp.store_id
        and sp.region_id is distinct from ${regionId}::text and ${target}
      returning sp.store_id, old.region_id as old_region, sp.region_id as new_region),
    logged as (${logCompanyEvent(
      companyId,
      actor,
      "store_moved",
      "moved",
      sql`jsonb_build_object('store', (select name from organization where id = r.store_id), 'from', (select name from regions where id = r.old_region), 'to', (select name from regions where id = r.new_region))`,
    )})
    select id from logged`);
  } catch (error) {
    // The region was deleted between the existence check and the update (store_profiles.region_id's foreign key).
    if (hasCode(error, "23503")) return { status: "gone" };
    throw error;
  }
  if (done.rows.length === 1) return { status: "moved" };
  // Nothing moved: the store is already in that region (unchanged), or it is not this company's store, or the
  // target region is another company's or was deleted (gone). Only the first is a no-op.
  const here = await db.execute(sql`select region_id from store_profiles where store_id = ${storeId} and company_id = ${companyId}`);
  if (here.rows.length !== 1) return { status: "gone" };
  const current = (here.rows[0] as { region_id: string | null }).region_id;
  return { status: current === regionId ? "unchanged" : "gone" };
}
