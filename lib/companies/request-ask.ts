// "Ask a question" on a pending request (spec 0.7.1 5.3, 9.1): the admin opens the request's help thread, or
// continues it when one is open. The thread is `kind = company_request` and carries `company_request_id`; one
// open thread per request is the table's partial unique. The first message is from Liminal Bloom and the thread
// starts "answered", so it reaches the requester as a reply. Runs as the table owner after the admin guard.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { type AdminHelpOutcome, adminReplyTo } from "@/lib/admin/actions-help";
import type { AdminActor } from "@/lib/admin/events";
import { cleanBody, MIN_REPLY_BODY } from "@/lib/help/limits";

type Row = Record<string, unknown>;

export type AskOutcome = AdminHelpOutcome | { status: "not-pending" };

async function openThreadOf(requestId: string): Promise<string | null> {
  const { rows } = await db.execute<Row>(sql`select id from help_requests where company_request_id = ${requestId} and status <> 'closed'`);
  return rows[0] ? String(rows[0].id) : null;
}

export async function askAboutRequest(actor: AdminActor, requestId: string, rawBody: unknown): Promise<AskOutcome> {
  const body = cleanBody(rawBody, MIN_REPLY_BODY);
  if (!body) return { status: "invalid-body" };
  const existing = await openThreadOf(requestId);
  if (existing) return adminReplyTo(actor, existing, body);
  const { rows } = await db.execute<Row>(sql`
    with req as (select id, requester_id, company_name from company_requests where id = ${requestId} and status = 'pending'),
    made as (
      insert into help_requests (requester_id, kind, status, context, company_request_id, admin_seen_at)
      select requester_id, 'company_request', 'answered', jsonb_build_object('state', 'company-request', 'companyName', company_name), id, now() from req
      on conflict (company_request_id) where status <> 'closed' do nothing
      returning id),
    said as (
      insert into help_messages (request_id, author_id, author_name, from_admin, body)
      select id, ${actor.userId}::text, ${actor.name}::text, true, ${body}::text from made)
    select (select id from made) as made, (select count(*) from req)::int as found`);
  if (rows[0]?.made) return { status: "done" };
  if (Number(rows[0]?.found) === 0) return { status: "not-pending" };
  // Another question opened the thread between the two reads: continue it.
  const raced = await openThreadOf(requestId);
  return raced ? adminReplyTo(actor, raced, body) : { status: "gone" };
}
