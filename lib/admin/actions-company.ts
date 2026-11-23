// Liminal Bloom's help actions on a company (spec 0.7.1 7.4): Pause and Restore a company, Hand ownership to a corporate
// admin, Cancel a company invitation. Each is ONE statement with its `platform_events` row, carrying the company id so the
// owner's Recent changes shows it (spec 6.2, lib/companies/events-text.ts). Nothing here is written to `company_events`:
// the spec asks for a company row only for the owner's own changes, and a store's Liminal Bloom row is its own record.
// Runs as the table owner; each server action awaits requirePlatformAdminForAction and passes the admin it returned.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { handOffOwnership } from "@/lib/companies/handoff";

import { type AdminActor, platformEventFrom } from "./events";

type Row = Record<string, unknown>;

export type CompanyOutcome = { status: "done"; name: string } | { status: "gone" | "already" };

async function change(actor: AdminActor, companyId: string, reason: string, kind: "pause" | "restore"): Promise<CompanyOutcome> {
  const paused = kind === "pause";
  const action = paused ? "company_paused" : "company_restored";
  const write = paused
    ? sql`update companies c set suspended_at = now(), suspended_reason = ${reason}::text, suspended_by_name = ${actor.name}::text, version = c.version + 1, updated_at = now()
        from target t where c.id = t.id and c.suspended_at is null returning c.id, c.name`
    : sql`update companies c set suspended_at = null, suspended_reason = null, suspended_by_name = null, version = c.version + 1, updated_at = now()
        from target t where c.id = t.id and c.suspended_at is not null returning c.id, c.name`;
  const { rows } = await db.execute<Row>(sql`
    with target as (select id from companies where id = ${companyId}),
    changed as (${write}),
    logged as (${platformEventFrom(actor, { action, targetKind: "company", targetId: sql`ch.id`, targetLabel: sql`ch.name`, reason, companyId: sql`ch.id` }, sql`changed ch`)})
    select name from changed`);
  if (rows[0]) return { status: "done", name: String(rows[0].name) };
  // Nothing changed: no such company, or it is already in the state asked for.
  const exists = await db.execute<Row>(sql`select 1 as found from companies where id = ${companyId}`);
  return { status: exists.rows.length === 0 ? "gone" : "already" };
}

/** Pauses a company: every store of it drops out for everyone (lib/access/grants.ts). `already`: it is paused. */
export const pauseCompany = (actor: AdminActor, companyId: string, reason: string) => change(actor, companyId, reason, "pause");

/** Lifts a company's pause. `already`: it is not paused. */
export const restoreCompany = (actor: AdminActor, companyId: string, reason: string) => change(actor, companyId, reason, "restore");

export type CancelCompanyOutcome = { status: "done"; email: string; companyName: string } | { status: "gone" };

/** Cancels a pending company invitation (spec 7.4). `gone`: not pending any more. */
export async function cancelCompanyInvitationAsAdmin(actor: AdminActor, invitationId: string, reason: string): Promise<CancelCompanyOutcome> {
  const { rows } = await db.execute<Row>(sql`
    with changed as (
      update company_invitations ci set status = 'canceled'
      from companies c
      where ci.id = ${invitationId} and ci.status = 'pending' and c.id = ci.company_id
      returning ci.id, ci.email, ci.company_id, c.name as company_name),
    logged as (${platformEventFrom(actor, { action: "invitation_canceled", targetKind: "invitation", targetId: sql`ch.id`, targetLabel: sql`ch.email`, reason, companyId: sql`ch.company_id`, detail: sql`jsonb_build_object('company', ch.company_name)` }, sql`changed ch`)})
    select email, company_name from changed`);
  return rows[0] ? { status: "done", email: String(rows[0].email), companyName: String(rows[0].company_name) } : { status: "gone" };
}

/**
 * Hands ownership to a corporate admin, run by Liminal Bloom (spec 5.5, 7.4), pinned to the company version the admin saw.
 * `already`: the version moved (a change since the page was read); `gone`: that person is not a corporate admin of it.
 */
export async function handOffCompanyAsAdmin(actor: AdminActor, companyId: string, toUserId: string, seenVersion: number, reason: string): Promise<CompanyOutcome> {
  const out = await handOffOwnership(companyId, { userId: actor.userId, name: actor.name }, toUserId, seenVersion, { actor, reason });
  if (out.status === "handed") return { status: "done", name: out.name };
  return { status: out.status === "stale" ? "already" : "gone" };
}
