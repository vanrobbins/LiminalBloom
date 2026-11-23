// What the requester can change (spec 0.7.1 9.2): open a request, reply, close, mark seen. Each change that
// has a second row is ONE statement (data-modifying CTEs), so a request never exists without its message and
// the limits are checked in the same statement that writes. Read and written as the table owner: every
// statement filters by the requester's id by hand, so another person's thread is "gone", not refused.
// Races: a batch is one transaction whose first statement takes a per-person (open) or per-request (reply)
// advisory lock, so the limits are counted after any concurrent writer has finished.

import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { helpRequests } from "@/db/schema";

import { askableKind, type HelpKind, threadId } from "./kinds";
import { cleanBody, type HelpOutcome, MAX_MESSAGES, MAX_OPEN_REQUESTS, MIN_FIRST_BODY, MIN_REPLY_BODY } from "./limits";

type Row = Record<string, unknown>;
type Requester = { id: string; name: string };

export type OpenInput = { kind: unknown; body: unknown; context: Record<string, unknown>; allowedKinds?: readonly HelpKind[] };

/** Opens a request with its first message, unless the person already has 5 open. */
export async function openRequest(who: Requester, input: OpenInput): Promise<HelpOutcome> {
  const kind = askableKind(input.kind, input.allowedKinds);
  if (!kind) return { status: "invalid-kind" };
  const body = cleanBody(input.body, MIN_FIRST_BODY);
  if (!body) return { status: "invalid-body" };
  const [, { rows }] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtext(${"open:" + who.id}))`),
    db.execute<Row>(sql`
    with mine as (select count(*)::int as n from help_requests where requester_id = ${who.id} and status <> 'closed'),
    made as (
      insert into help_requests (requester_id, kind, context)
      select ${who.id}::text, ${kind}::help_kind, ${JSON.stringify(input.context)}::jsonb from mine where n < ${MAX_OPEN_REQUESTS}
      returning id),
    said as (
      insert into help_messages (request_id, author_id, author_name, from_admin, body)
      select id, ${who.id}::text, ${who.name}::text, false, ${body}::text from made)
    select (select id from made) as id`),
  ]);
  const id = rows[0]?.id;
  return typeof id === "string" ? { status: "done", id } : { status: "too-many-open" };
}

/** Adds the requester's message. A reply to a replied request puts it back to waiting; a closed one takes none. */
export async function replyTo(who: Requester, rawId: unknown, rawBody: unknown): Promise<HelpOutcome> {
  const id = threadId(rawId);
  if (!id) return { status: "gone" };
  const body = cleanBody(rawBody, MIN_REPLY_BODY);
  if (!body) return { status: "invalid-body" };
  let rows: Row[];
  try {
    [, { rows }] = await db.batch([
      db.execute(sql`select pg_advisory_xact_lock(hashtext(${"reply:" + id}))`),
      db.execute<Row>(sql`
    with r as (
      select id, status, (select count(*) from help_messages m where m.request_id = help_requests.id)::int as n
      from help_requests where id = ${id}::uuid and requester_id = ${who.id}),
    changed as (
      update help_requests h set status = 'open', updated_at = now(), version = h.version + 1, requester_seen_at = now()
      from r where h.id = r.id and h.status <> 'closed' and r.status <> 'closed' and r.n < ${MAX_MESSAGES}
      returning h.id),
    said as (
      insert into help_messages (request_id, author_id, author_name, from_admin, body)
      select id, ${who.id}::text, ${who.name}::text, false, ${body}::text from changed)
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

/** The requester closes their own request. Closing twice says it is already closed. */
export async function closeRequest(userId: string, rawId: unknown): Promise<HelpOutcome> {
  const id = threadId(rawId);
  if (!id) return { status: "gone" };
  const changed = await db
    .update(helpRequests)
    .set({ status: "closed", closedBy: "requester", updatedAt: sql`now()`, requesterSeenAt: sql`now()`, version: sql`${helpRequests.version} + 1` })
    .where(and(eq(helpRequests.id, id), eq(helpRequests.requesterId, userId), ne(helpRequests.status, "closed")))
    .returning({ id: helpRequests.id });
  if (changed.length > 0) return { status: "done" };
  const [still] = await db.select({ id: helpRequests.id }).from(helpRequests).where(and(eq(helpRequests.id, id), eq(helpRequests.requesterId, userId)));
  return { status: still ? "closed" : "gone" };
}

/** Opening a thread: the reply badge counts only what is newer than this. `updated_at` is left alone. */
export async function markSeen(userId: string, rawId: unknown): Promise<void> {
  const id = threadId(rawId);
  if (!id) return;
  await db.update(helpRequests).set({ requesterSeenAt: sql`now()` }).where(and(eq(helpRequests.id, id), eq(helpRequests.requesterId, userId)));
}
