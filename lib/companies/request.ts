// What the requester can do with a company request (spec 0.7.1 5.1): send one and withdraw it. Send is one
// statement that refuses an owner (they must hand the company off first); the one-pending rule is the table's
// partial unique, which a second send hits. Withdraw is one statement that also closes the request's help
// thread. Runs as the table owner: every statement filters by the requester's id by hand.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { cleanCompanyName } from "./request-rules";

type Row = Record<string, unknown>;

export type SendOutcome = { status: "done"; id: string } | { status: "invalid-name" | "pending" | "owner" };

const PENDING_UNIQUE = "company_requests_pending_unique";

export async function sendRequest(userId: string, rawName: unknown): Promise<SendOutcome> {
  const name = cleanCompanyName(rawName);
  if (!name) return { status: "invalid-name" };
  try {
    const { rows } = await db.execute<Row>(sql`
      insert into company_requests (requester_id, company_name)
      select ${userId}::text, ${name}::text where not exists (select 1 from companies where owner_user_id = ${userId})
      returning id`);
    return rows[0] ? { status: "done", id: String(rows[0].id) } : { status: "owner" };
  } catch (e) {
    if (String(e).includes(PENDING_UNIQUE) || String((e as { cause?: unknown }).cause).includes(PENDING_UNIQUE)) return { status: "pending" };
    throw e;
  }
}

export type WithdrawOutcome = { status: "done" | "gone" | "already" };

/** Withdraws the person's own pending request. `already`: it was decided first; `gone`: it is not theirs. */
export async function withdrawRequest(userId: string, id: string): Promise<WithdrawOutcome> {
  const { rows } = await db.execute<Row>(sql`
    with changed as (
      update company_requests set status = 'withdrawn', version = version + 1, updated_at = now()
      where id = ${id} and requester_id = ${userId} and status = 'pending' returning id),
    thread as (
      update help_requests h set status = 'closed', closed_by = 'requester', updated_at = now(), requester_seen_at = now(), version = h.version + 1
      where h.company_request_id in (select id from changed) and h.status <> 'closed' returning h.id)
    select id from changed`);
  if (rows[0]) return { status: "done" };
  const mine = await db.execute<Row>(sql`select 1 as found from company_requests where id = ${id} and requester_id = ${userId}`);
  return { status: mine.rows[0] ? "already" : "gone" };
}
