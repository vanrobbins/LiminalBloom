// What the requester's screens read about their company request and where they stand (spec 0.7.1 5.1, 5.2).
// Every query filters by the person's id by hand: these tables are read as the owner. Nothing here carries an
// admin's name.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

type Row = Record<string, unknown>;

export type RequestCard = {
  id: string;
  name: string;
  status: "pending" | "rejected";
  reason: string | null;
  /** The request's open help thread, if there is one: Liminal Bloom asked, or the person wrote. */
  thread: { id: string; answered: boolean } | null;
};

/** The person's latest request when it is waiting or was rejected; approved and withdrawn ones show no card. */
export async function requestCardFor(userId: string): Promise<RequestCard | null> {
  const { rows } = await db.execute<Row>(sql`
    select r.id, r.company_name, r.status, r.decision_reason,
      (select h.id from help_requests h where h.company_request_id = r.id and h.status <> 'closed') as thread_id,
      (select h.status = 'answered' from help_requests h where h.company_request_id = r.id and h.status <> 'closed') as answered
    from company_requests r where r.requester_id = ${userId} order by r.created_at desc, r.id desc limit 1`);
  const r = rows[0];
  if (!r || (r.status !== "pending" && r.status !== "rejected")) return null;
  return {
    id: String(r.id),
    name: String(r.company_name),
    status: r.status,
    reason: r.decision_reason === null ? null : String(r.decision_reason),
    thread: r.thread_id ? { id: String(r.thread_id), answered: r.answered === true } : null,
  };
}

export type StandingCompany = { id: string; name: string; role: "owner" | "corporate_admin" | "regional_manager" | "member" };

/** The company the person is in now: owner, a company role, or a member of one of its stores. Null if none. */
export async function standingCompanyOf(userId: string): Promise<StandingCompany | null> {
  const { rows } = await db.execute<Row>(sql`
    select id, name, role from (
      select c.id, c.name, 'owner' as role, 1 as ord from companies c where c.owner_user_id = ${userId}
      union all select c.id, c.name, ra.role::text, 2 from role_assignments ra join companies c on c.id = ra.company_id where ra.user_id = ${userId}
      union all select c.id, c.name, 'member', 3 from member m join store_profiles sp on sp.store_id = m.organization_id join companies c on c.id = sp.company_id where m.user_id = ${userId}
    ) t order by ord, name limit 1`);
  const r = rows[0];
  return r ? { id: String(r.id), name: String(r.name), role: r.role as StandingCompany["role"] } : null;
}
