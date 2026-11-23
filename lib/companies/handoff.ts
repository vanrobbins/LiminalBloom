// Handing ownership to a corporate admin (spec 0.7.1 5.5): ONE statement, pinned to the company `version` the owner
// saw and to the chosen person still being a corporate admin of this company. It locks the company row and the
// assignment (FOR UPDATE), then in order: deletes the new owner's assignment, makes them `owner_user_id`, inserts the
// old owner as a corporate admin, and writes the `ownership_handed_off` row. Each step reads the one before's
// RETURNING, so none runs without the one before it and a stale version or a removed admin changes nothing. Only the
// owner (a fact on `companies`, not a role) may call it; the old owner stays, ranked below.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import type { CompanyInviter } from "./invite";

const hasCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && (("code" in error && error.code === code) || ("cause" in error && hasCode(error.cause, code)));

export type HandoffOutcome = { status: "handed"; name: string } | { status: "forbidden" | "stale" | "gone" };

export async function handOffOwnership(companyId: string, actor: Pick<CompanyInviter, "userId" | "name">, toUserId: string, seenVersion: number): Promise<HandoffOutcome> {
  if (toUserId === actor.userId) return { status: "forbidden" };
  const [owner] = (await db.execute<{ ok: boolean }>(sql`select exists (select 1 from companies where id = ${companyId} and owner_user_id = ${actor.userId}) as ok`)).rows;
  if (!owner?.ok) return { status: "forbidden" };
  const { rows: found } = await db.execute<{ name: string }>(sql`
    select u.name from role_assignments ra join "user" u on u.id = ra.user_id where ra.user_id = ${toUserId} and ra.company_id = ${companyId} and ra.role = 'corporate_admin'`);
  if (!found[0]) return { status: "gone" };
  const { name } = found[0];

  const company = sql`${companyId}::text`;
  let done;
  try {
    done = await db.execute(sql`
    with cur as (
      select c.id from companies c where c.id = ${company} and c.owner_user_id = ${actor.userId}::text and c.version = ${seenVersion}
        and not exists (select 1 from companies o where o.owner_user_id = ${toUserId}::text)
      for update of c),
    target as (
      select ra.user_id from role_assignments ra
      where ra.user_id = ${toUserId}::text and ra.company_id = ${company} and ra.role = 'corporate_admin' and exists (select 1 from cur)
      for update of ra),
    dropped as (delete from role_assignments ra where ra.user_id in (select user_id from target) returning ra.user_id),
    flipped as (
      update companies c set owner_user_id = d.user_id, version = c.version + 1, updated_at = now()
      from dropped d where c.id = ${company} and c.owner_user_id = ${actor.userId}::text
      returning c.id),
    demoted as (
      insert into role_assignments (user_id, company_id, role)
      select ${actor.userId}::text, f.id, 'corporate_admin' from flipped f returning user_id),
    logged as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select ${company}, ${actor.userId}::text, ${actor.name}::text, 'ownership_handed_off', jsonb_build_object('from', ${actor.name}::text, 'to', ${name}::text)
      from demoted returning id)
    select id from logged`);
  } catch (error) {
    // The role's primary key: the old owner already holds a role here (cannot happen for an owner; defensive).
    if (hasCode(error, "23505")) return { status: "stale" };
    throw error;
  }
  return done.rows.length === 1 ? { status: "handed", name } : { status: "stale" };
}
