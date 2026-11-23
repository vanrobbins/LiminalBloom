// Rejecting a company request (spec 0.7.1 5.3): the reason is what the requester reads. ONE statement with the
// decision, the request's help thread closed and the `platform_events` row, pinned to pending at the version
// the admin looked at. Runs as the table owner after the action's admin guard.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { type AdminActor, platformEventFrom } from "@/lib/admin/events";

type Row = Record<string, unknown>;

export type RejectOutcome = { status: "done" | "gone" | "already" };

export async function rejectRequest(actor: AdminActor, input: { id: string; version: number }, reason: string): Promise<RejectOutcome> {
  const { id, version } = input;
  const event = { action: "company_rejected", targetKind: "company_request", targetId: id, targetLabel: sql`d.company_name`, reason, detail: sql`jsonb_build_object('requester', u.name)` } as const;
  const { rows } = await db.execute<Row>(sql`
    with decided as (
      update company_requests set status = 'rejected', decided_by = ${actor.userId}, decided_by_name = ${actor.name}, decision_reason = ${reason},
        version = version + 1, updated_at = now()
      where id = ${id} and status = 'pending' and version = ${version} returning id, requester_id, company_name),
    thread as (
      update help_requests h set status = 'closed', closed_by = 'admin', updated_at = now(), version = h.version + 1
      where h.company_request_id in (select id from decided) and h.status <> 'closed' returning h.id),
    logged as (${platformEventFrom(actor, event, sql`decided d join "user" u on u.id = d.requester_id`)})
    select id from decided`);
  if (rows[0]) return { status: "done" };
  const exists = await db.execute<Row>(sql`select 1 as found from company_requests where id = ${id}`);
  return { status: exists.rows[0] ? "already" : "gone" };
}
