// What /invite/[id] reads for a company invitation (spec 0.7.1 6.5). The page looks the id up in `invitation`
// first (lib/access/invitation-look.ts), then here; ids are 192-bit, so the two never collide. The answer is the same
// InvitationState a store invitation gives, with the company's name where a store's goes: nothing here shows the
// invited address, and a signed-out visitor learns the company and role at most. Runs as the table owner.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { companyRole, type CompanyRoleKey } from "@/lib/access/company-roles";
import type { InvitationState, Viewer } from "@/lib/access/invitation-look";

import { inviterMayGrantCompany } from "./authority";
import { otherCompanyName } from "./one-company";

type Row = { company_id: string; company_name: string; email: string; role: CompanyRoleKey; status: string; expired: boolean; lapsed: boolean; paused: boolean; here: boolean };

/** Null when no company invitation has this id (the caller says "missing" or tries another kind). */
export async function lookCompanyInvitation(id: string, viewer: Viewer | null, now: Date = new Date()): Promise<InvitationState | null> {
  const { rows } = await db.execute<Row>(sql`
    select i.company_id, c.name as company_name, i.email, i.role::text as role, i.status::text as status,
      i.expires_at <= ${now.toISOString()}::timestamptz as expired,
      not ${inviterMayGrantCompany(sql`i.company_id`, sql`i.role`, sql`i.inviter_id`)} as lapsed,
      c.suspended_at is not null as paused,
      ${viewer ? sql`(c.owner_user_id = ${viewer.id} or exists (select 1 from role_assignments ra where ra.user_id = ${viewer.id}))` : sql`false`} as here
    from company_invitations i join companies c on c.id = i.company_id where i.id = ${id}`);
  const row = rows[0];
  if (!row) return null;
  if (row.status === "accepted") return { state: "used" };
  if (row.status === "canceled") return { state: "cancelled" };
  const named = { storeName: row.company_name, roleName: companyRole(row.role).name };
  if (row.expired) return { state: "expired", ...named };
  if (row.lapsed) return { state: "lapsed", ...named };
  if (!viewer) return { state: "signed-out", ...named };
  if (viewer.email.trim().toLowerCase() !== row.email.trim().toLowerCase()) return { state: "wrong-email", ...named };
  // Already in this company, or in another one: the one-company rule (5.4).
  const other = await otherCompanyName(viewer.id, sql`${row.company_id}::text`);
  if (other) return { state: "in-company", companyName: other, ...named };
  if (row.here) return { state: "already-member", ...named };
  // A paused company takes no one new until Liminal Bloom restores it (accept refuses the same way).
  if (row.paused) return { state: "company-paused", ...named };
  return { state: "ready", ...named };
}
