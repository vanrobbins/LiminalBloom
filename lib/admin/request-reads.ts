// What the admin company-request screens read (spec 0.7.1 5.3, 7.3): the list (pending first) and one request with
// the requester's account (name, email, created, stores with roles, the company they are in now) and the
// request's help thread. Account-level facts only. Runs as the table owner; every page that calls these has
// already awaited its guard, and the one query that takes an id filters by it by hand.

import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { member, organization, user } from "@/db/auth-schema";
import { companyRequests, roleDefinitions } from "@/db/schema";
import { type StandingCompany, standingCompanyOf } from "@/lib/companies/request-reads";
import type { RequestStatus } from "@/lib/companies/request-rules";
import { threadId } from "@/lib/help/kinds";

import { type AdminHelpThread, adminHelpThread } from "./help-reads";

export const REQUEST_LIMIT = 100;

export type AdminRequestItem = { id: string; name: string; status: RequestStatus; requesterName: string; createdAt: Date; decidedAt: Date };

const ITEM = { id: companyRequests.id, name: companyRequests.companyName, status: companyRequests.status, requesterName: user.name, createdAt: companyRequests.createdAt, decidedAt: companyRequests.updatedAt };

/** Pending oldest first (the one waiting longest on top), then the decided, newest first. */
export async function adminRequestList(): Promise<{ pending: AdminRequestItem[]; decided: AdminRequestItem[] }> {
  const base = () => db.select(ITEM).from(companyRequests).innerJoin(user, eq(user.id, companyRequests.requesterId));
  const [pending, decided] = await Promise.all([
    base().where(eq(companyRequests.status, "pending")).orderBy(asc(companyRequests.createdAt), asc(companyRequests.id)).limit(REQUEST_LIMIT),
    base().where(inArray(companyRequests.status, ["approved", "rejected", "withdrawn"])).orderBy(desc(companyRequests.updatedAt), asc(companyRequests.id)).limit(REQUEST_LIMIT),
  ]);
  return { pending, decided };
}

export type AdminRequestDetail = {
  id: string;
  version: number;
  name: string;
  status: RequestStatus;
  createdAt: Date;
  decidedAt: Date;
  decidedByName: string | null;
  reason: string | null;
  requester: { name: string; email: string; createdAt: Date; stores: { id: string; name: string; roleName: string | null }[]; company: StandingCompany | null };
  thread: AdminHelpThread | null;
};

/** One request with the requester's account and the latest help thread about it, or null when there is no such request. */
export async function adminRequestDetail(rawId: unknown): Promise<AdminRequestDetail | null> {
  const id = threadId(rawId);
  if (!id) return null;
  const [found] = await db
    .select({ r: companyRequests, name: user.name, email: user.email, createdAt: user.createdAt })
    .from(companyRequests)
    .innerJoin(user, eq(user.id, companyRequests.requesterId))
    .where(eq(companyRequests.id, id));
  if (!found) return null;
  const { r } = found;
  const [stores, company, latest] = await Promise.all([
    db
      .select({ id: organization.id, name: organization.name, roleName: roleDefinitions.name })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
      .where(eq(member.userId, r.requesterId))
      .orderBy(asc(organization.name), asc(organization.id)),
    standingCompanyOf(r.requesterId),
    db.execute<{ id: string }>(sql`select id from help_requests where company_request_id = ${id} order by (status <> 'closed') desc, created_at desc limit 1`),
  ]);
  const thread = latest.rows[0] ? await adminHelpThread(latest.rows[0].id) : null;
  return {
    id: r.id,
    version: r.version,
    name: r.companyName,
    status: r.status,
    createdAt: r.createdAt,
    decidedAt: r.updatedAt,
    decidedByName: r.decidedByName,
    reason: r.decisionReason,
    requester: { name: found.name, email: found.email, createdAt: found.createdAt, stores, company },
    thread,
  };
}
