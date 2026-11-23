// Approving a company request (spec 0.7.1 5.3): ONE statement, so the company, the person leaving their old one,
// the decision and the log all happen or none do. Pinned to the request still being pending at the version the
// admin looked at. It makes the company (the requester its owner), deletes their company role and their member
// rows in that company's stores (each with a store log line, "left for another company"), leaves every other
// membership alone (a standalone store stays: DECISIONS 11-11), marks the request approved and closes its help
// thread. A taken slug or a requester who owns a company changes nothing and says so.
//
// Runs as the table owner; the action's guard has already run and passes the admin it returned.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { type AdminActor, platformEventFrom, storeEventFrom } from "@/lib/admin/events";

import { slugifyCompany } from "./request-rules";

type Row = Record<string, unknown>;

export type ApproveOutcome = { status: "done"; companyId: string; name: string } | { status: "gone" | "already" | "slug-taken" } | { status: "owner"; companyName: string };

/** Who and what the request names, read before the statement for the slug and the refusals. */
async function readRequest(id: string) {
  const { rows } = await db.execute<Row>(sql`select requester_id, company_name, status, version from company_requests where id = ${id}`);
  return rows[0] ?? null;
}

export async function approveRequest(actor: AdminActor, input: { id: string; version: number }, reason: string): Promise<ApproveOutcome> {
  const { id, version } = input;
  const found = await readRequest(id);
  if (!found) return { status: "gone" };
  if (found.status !== "pending" || Number(found.version) !== version) return { status: "already" };
  const slug = slugifyCompany(String(found.company_name), id);

  const left = sql`left_members l join "user" u on u.id = l.user_id`;
  const event = {
    action: "company_approved",
    targetKind: "company_request",
    targetId: id,
    targetLabel: sql`m.name`,
    companyId: sql`m.id`,
    reason,
    detail: sql`jsonb_build_object('requester', p.person, 'email', p.email, 'leftCompanies', (select count(*) from old))`,
  } as const;
  const { rows } = await db.execute<Row>(sql`
    with req as (
      select r.requester_id, r.company_name, u.name as person, u.email
      from company_requests r join "user" u on u.id = r.requester_id
      where r.id = ${id} and r.status = 'pending' and r.version = ${version}
        and not exists (select 1 from companies c where c.owner_user_id = r.requester_id)),
    made as (
      insert into companies (name, slug, owner_user_id)
      select company_name, ${slug}::text, requester_id from req
      on conflict (slug) do nothing
      returning id, name, owner_user_id),
    old as (
      select ra.company_id from role_assignments ra where ra.user_id in (select owner_user_id from made)
      union
      select sp.company_id from member m join store_profiles sp on sp.store_id = m.organization_id where m.user_id in (select owner_user_id from made)),
    left_members as (
      delete from member m using store_profiles sp
      where sp.store_id = m.organization_id and m.user_id in (select owner_user_id from made) and sp.company_id in (select company_id from old)
      returning m.organization_id as store_id, m.user_id),
    left_roles as (delete from role_assignments where user_id in (select owner_user_id from made) returning user_id),
    store_log as (${storeEventFrom(sql`l.store_id`, "member_left_company", sql`jsonb_build_object('person', u.name)`, left)}),
    old_log as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select o.company_id, null, 'Liminal Bloom', 'person_left', jsonb_build_object('person', p.person, 'why', 'requested a new company') from old o cross join req p),
    new_log as (
      insert into company_events (company_id, actor_id, actor_name, event, detail)
      select m.id, null, 'Liminal Bloom', 'company_created', jsonb_build_object('name', m.name, 'owner', p.person) from made m cross join req p),
    decided as (
      update company_requests r set status = 'approved', decided_by = ${actor.userId}, decided_by_name = ${actor.name}, decision_reason = ${reason},
        company_id = m.id, version = r.version + 1, updated_at = now()
      from made m where r.id = ${id} and r.status = 'pending' returning r.id),
    thread as (
      update help_requests h set status = 'closed', closed_by = 'admin', updated_at = now(), version = h.version + 1
      where h.company_request_id = ${id} and h.status <> 'closed' and exists (select 1 from made) returning h.id),
    logged as (${platformEventFrom(actor, event, sql`made m cross join req p`)})
    select m.id, m.name from made m`);
  if (rows[0]) return { status: "done", companyId: String(rows[0].id), name: String(rows[0].name) };

  // Nothing changed. Say why: they own a company, the slug is taken, or someone decided it first.
  const owned = await db.execute<Row>(sql`select name from companies where owner_user_id = ${String(found.requester_id)}`);
  if (owned.rows[0]) return { status: "owner", companyName: String(owned.rows[0].name) };
  const taken = await db.execute<Row>(sql`select 1 as taken from companies where slug = ${slug}`);
  return taken.rows[0] ? { status: "slug-taken" } : { status: "already" };
}
