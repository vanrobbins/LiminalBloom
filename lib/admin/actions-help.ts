// An admin answers and closes a help request (spec 0.7.1 7.4, 9.2). Each is ONE statement: the reply inserts its
// message (the admin's name stored, for admins only) and sets `answered` with `updated_at` from the database;
// the close sets `closed` and `closed_by = 'admin'` (a check ties the two) and inserts the `help_closed`
// platform event from the row that changed. Nothing here is shown to the requester with a name: their reads
// (lib/help/queries.ts) never select one. Runs as the table owner; the action's guard has already run.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { threadId } from "@/lib/help/kinds";
import { cleanBody, MAX_MESSAGES, MIN_REPLY_BODY } from "@/lib/help/limits";
import { replyLock } from "@/lib/help/lock";

import { type AdminActor, platformEventFrom } from "./events";

type Row = Record<string, unknown>;

export type AdminHelpOutcome = { status: "done" | "invalid-body" | "too-many-messages" | "closed" | "gone" | "already" };

/** Replies as Liminal Bloom. A closed request takes none; a full one (50 messages) takes none. */
export async function adminReplyTo(actor: AdminActor, rawId: unknown, rawBody: unknown): Promise<AdminHelpOutcome> {
  const id = threadId(rawId);
  if (!id) return { status: "gone" };
  const body = cleanBody(rawBody, MIN_REPLY_BODY);
  if (!body) return { status: "invalid-body" };
  let rows: Row[];
  try {
    [, { rows }] = await db.batch([
      replyLock(id),
      db.execute<Row>(sql`
    with r as (
      select id, status, (select count(*) from help_messages m where m.request_id = help_requests.id)::int as n
      from help_requests where id = ${id}::uuid),
    changed as (
      update help_requests h set status = 'answered', updated_at = now(), version = h.version + 1, admin_seen_at = now()
      from r where h.id = r.id and h.status <> 'closed' and r.status <> 'closed' and r.n < ${MAX_MESSAGES}
      returning h.id),
    said as (
      insert into help_messages (request_id, author_id, author_name, from_admin, body)
      select id, ${actor.userId}::text, ${actor.name}::text, true, ${body}::text from changed)
    select (select id from changed) as changed, (select status from r) as status, (select count(*) from r)::int as found`),
    ]);
  } catch (e) {
    if (String(e).includes("help_requests_closed_by")) return { status: "closed" };
    throw e;
  }
  const row = rows[0];
  if (row?.changed) return { status: "done" };
  if (Number(row?.found) === 0) return { status: "gone" };
  return { status: row?.status === "closed" ? "closed" : "too-many-messages" };
}

/** Closes a request for good, with the reason in the admin log. `already`: it was closed. */
export async function adminCloseRequest(actor: AdminActor, rawId: unknown, reason: string): Promise<AdminHelpOutcome> {
  const id = threadId(rawId);
  if (!id) return { status: "gone" };
  const source = sql`changed c join help_requests h on h.id = c.id join "user" u on u.id = h.requester_id`;
  const event = { action: "help_closed", targetKind: "help_request", targetId: sql`c.id::text`, targetLabel: sql`u.name`, reason, detail: sql`jsonb_build_object('kind', h.kind)` } as const;
  const [, { rows }] = await db.batch([
    replyLock(id),
    db.execute<Row>(sql`
    with changed as (
      update help_requests set status = 'closed', closed_by = 'admin', updated_at = now(), version = version + 1
      where id = ${id}::uuid and status <> 'closed' returning id),
    logged as (${platformEventFrom(actor, event, source)})
    select id from changed`),
  ]);
  if (rows[0]) return { status: "done" };
  const found = await db.execute<Row>(sql`select 1 as found from help_requests where id = ${id}::uuid`);
  return { status: found.rows.length === 0 ? "gone" : "already" };
}
