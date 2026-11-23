// Handing ownership to a corporate admin (spec 0.7.1 5.5): ONE statement, pinned to the company `version` the owner
// saw and to the chosen person still being a corporate admin of this company. It locks the company row and the
// assignment (FOR UPDATE), then in order: deletes the new owner's assignment, makes them `owner_user_id`, inserts the
// old owner as a corporate admin, and writes the `ownership_handed_off` row. Each step reads the one before's
// RETURNING, so none runs without the one before it and a stale version or a removed admin changes nothing. Only the
// owner (a fact on `companies`, not a role) may call it; the old owner stays, ranked below.
//
// Liminal Bloom's hand-off (spec 7.4, the owner is gone) is the same statement with `admin` set: no owner check (the
// admin guard made that check), the old owner is whoever owns the company when the statement runs, and the row is a
// `platform_events` row with the company id (the owner's Recent changes reads it there, as for pause) instead of a
// `company_events` row.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { type AdminActor, platformEventFrom } from "@/lib/admin/events";

import type { CompanyInviter } from "./invite";

const hasCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && (("code" in error && error.code === code) || ("cause" in error && hasCode(error.cause, code)));

export type HandoffOutcome = { status: "handed"; name: string } | { status: "forbidden" | "stale" | "gone" };

/** Set by Liminal Bloom's hand-off: the admin acting and the reason the platform event carries. */
export type AdminHandOff = { actor: AdminActor; reason: string };

/** `actor` is the owner (ignored when `admin` is set). */
export async function handOffOwnership(companyId: string, actor: Pick<CompanyInviter, "userId" | "name">, toUserId: string, seenVersion: number, admin?: AdminHandOff): Promise<HandoffOutcome> {
  if (!admin) {
    if (toUserId === actor.userId) return { status: "forbidden" };
    const [owner] = (await db.execute<{ ok: boolean }>(sql`select exists (select 1 from companies where id = ${companyId} and owner_user_id = ${actor.userId}) as ok`)).rows;
    if (!owner?.ok) return { status: "forbidden" };
  }
  const { rows: found } = await db.execute<{ name: string }>(sql`
    select u.name from role_assignments ra join "user" u on u.id = ra.user_id where ra.user_id = ${toUserId} and ra.company_id = ${companyId} and ra.role = 'corporate_admin'`);
  if (!found[0]) return { status: "gone" };
  const { name } = found[0];

  const company = sql`${companyId}::text`;
  const byOwner = admin ? sql`true` : sql`c.owner_user_id = ${actor.userId}::text`;
  // The old owner is whoever `cur` found: the owner for a person's hand-off, and the owner now for the admin's.
  const tail = admin
    ? sql`, plogged as (${platformEventFrom(admin.actor, { action: "ownership_handed_off", targetKind: "company", targetId: sql`f.id`, targetLabel: sql`f.name`, reason: admin.reason, companyId: sql`f.id`, detail: sql`jsonb_build_object('from', (select u.name from "user" u where u.id = f.old_owner), 'to', ${name}::text)` }, sql`flipped f`)})
      select f.id from flipped f`
    : sql`, logged as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select ${company}, ${actor.userId}::text, ${actor.name}::text, 'ownership_handed_off', jsonb_build_object('from', ${actor.name}::text, 'to', ${name}::text)
      from demoted returning id)
    select id from logged`;
  let done;
  try {
    done = await db.execute(sql`
    with cur as (
      select c.id, c.owner_user_id as old_owner from companies c where c.id = ${company} and ${byOwner} and c.version = ${seenVersion}
        and not exists (select 1 from companies o where o.owner_user_id = ${toUserId}::text)
      for update of c),
    target as (
      select ra.user_id from role_assignments ra
      where ra.user_id = ${toUserId}::text and ra.company_id = ${company} and ra.role = 'corporate_admin' and exists (select 1 from cur)
      for update of ra),
    dropped as (delete from role_assignments ra where ra.user_id in (select user_id from target) returning ra.user_id),
    flipped as (
      update companies c set owner_user_id = d.user_id, version = c.version + 1, updated_at = now()
      from dropped d, cur where c.id = cur.id
      returning c.id, c.name, cur.old_owner as old_owner),
    demoted as (
      insert into role_assignments (user_id, company_id, role)
      select f.old_owner, f.id, 'corporate_admin' from flipped f returning user_id)${tail}`);
  } catch (error) {
    // The role's primary key: the old owner already holds a role here (cannot happen for an owner; defensive).
    if (hasCode(error, "23505")) return { status: "stale" };
    throw error;
  }
  return done.rows.length === 1 ? { status: "handed", name } : { status: "stale" };
}
