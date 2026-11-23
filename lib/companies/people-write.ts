// Changing a company person (spec 0.7.1 6.5): move a regional manager to another region, or remove a company role.
// Each is ONE statement that changes the role_assignments row and inserts its company_events row, pinned to the
// version and the role (so the rank) the dialog saw, and re-checking in the statement that the actor still holds a
// role that outranks it (authority.ts): a stale dialog or a demoted actor changes nothing. Nobody acts on themselves,
// and the owner is no assignment, so an owner is only ever changed by a hand-off. Runs as the table owner; the
// company id comes from the actor's own session.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { canAssignCompanyRole, type AssignableCompanyRoleKey } from "@/lib/access/company-roles";

import { actorMayAct, rankOf, roleNameSql } from "./authority";
import type { CompanyInviter } from "./invite";

export type PersonOutcome = { status: "changed" | "removed"; name: string } | { status: "forbidden" | "stale" | "gone" | "invalid" | "unchanged" };

type Target = { userId: string; name: string; role: AssignableCompanyRoleKey; regionId: string | null };

async function readTarget(companyId: string, userId: string): Promise<Target | null> {
  const { rows } = await db.execute<{ user_id: string; name: string; role: AssignableCompanyRoleKey; region_id: string | null }>(sql`
    select ra.user_id, u.name, ra.role::text as role, ra.region_id from role_assignments ra join "user" u on u.id = ra.user_id
    where ra.user_id = ${userId} and ra.company_id = ${companyId}`);
  const r = rows[0];
  return r ? { userId: r.user_id, name: r.name, role: r.role, regionId: r.region_id } : null;
}

/** Why a person may not be acted on, or null: not yourself, and strictly below your rank. */
const refusal = (actor: CompanyInviter, target: Target): "forbidden" | null => (target.userId === actor.userId || !canAssignCompanyRole(actor.role, target.role) ? "forbidden" : null);

/** After a write matched nothing: the person is gone, or something changed since the dialog opened. */
async function whyNot(companyId: string, userId: string): Promise<"gone" | "stale"> {
  return (await readTarget(companyId, userId)) ? "stale" : "gone";
}

const hasCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && (("code" in error && error.code === code) || ("cause" in error && hasCode(error.cause, code)));

/** Moves a regional manager to another region of the company. `seenVersion` is the assignment's version the page showed. */
export async function changeRegion(companyId: string, actor: CompanyInviter, userId: string, seenVersion: number, regionId: string): Promise<PersonOutcome> {
  const target = await readTarget(companyId, userId);
  if (!target) return { status: "gone" };
  const refused = refusal(actor, target);
  if (refused) return { status: refused };
  if (target.role !== "regional_manager") return { status: "invalid" };
  if (target.regionId === regionId) return { status: "unchanged" };
  const company = sql`${companyId}::text`;
  let done;
  try {
    done = await db.execute(sql`
      with moved as (
        update role_assignments ra set region_id = ${regionId}::text, version = ra.version + 1
        from role_assignments old
        where ra.user_id = ${userId}::text and ra.company_id = ${company} and old.user_id = ra.user_id
          and ra.role = 'regional_manager' and ra.version = ${seenVersion}
          and ra.region_id is distinct from ${regionId}::text
          and exists (select 1 from regions where id = ${regionId}::text and company_id = ${company})
          and ${actorMayAct(company, sql`${actor.userId}::text`, rankOf("regional_manager"))}
        returning old.region_id as old_region, ra.region_id as new_region),
      logged as (
        insert into company_events (company_id, actor_id, actor_name, event, detail)
        select ${company}, ${actor.userId}::text, ${actor.name}::text, 'company_region_changed',
          jsonb_build_object('person', ${target.name}::text, 'from', (select name from regions where id = m.old_region), 'to', (select name from regions where id = m.new_region))
        from moved m returning id)
      select id from logged`);
  } catch (error) {
    // The region was deleted between the check and the update (the composite foreign key).
    if (hasCode(error, "23503")) return { status: "stale" };
    throw error;
  }
  return done.rows.length === 1 ? { status: "changed", name: target.name } : { status: await whyNot(companyId, userId) };
}

/** Removes a company role. The person keeps any store membership they have; only the company role goes. */
export async function removeCompanyPerson(companyId: string, actor: CompanyInviter, userId: string, seenVersion: number): Promise<PersonOutcome> {
  const target = await readTarget(companyId, userId);
  if (!target) return { status: "gone" };
  const refused = refusal(actor, target);
  if (refused) return { status: refused };
  const company = sql`${companyId}::text`;
  const done = await db.execute(sql`
    with removed as (
      delete from role_assignments ra
      where ra.user_id = ${userId}::text and ra.company_id = ${company} and ra.role = ${target.role}::company_role and ra.version = ${seenVersion}
        and ${actorMayAct(company, sql`${actor.userId}::text`, rankOf(target.role))}
      returning ra.role, ra.region_id),
    logged as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select ${company}, ${actor.userId}::text, ${actor.name}::text, 'company_role_removed',
        jsonb_build_object('person', ${target.name}::text, 'role', ${roleNameSql(sql`r.role`)}, 'region', (select name from regions where id = r.region_id))
      from removed r returning id)
    select id from logged`);
  return done.rows.length === 1 ? { status: "removed", name: target.name } : { status: await whyNot(companyId, userId) };
}
