// Who may act on a company role, in SQL (spec 0.7.1 2.3, 6.5). The rank rule lives in code (`canActOnCompany` over
// the fixed company roles), so these fragments are built from it: no rank number is written twice. A statement puts
// the fragment in its own WHERE, so the authority it was checked with is re-checked at the write. `lock` takes the
// actor's row FOR SHARE, so a removal or hand-off still uncommitted when the statement starts is waited for and seen
// (as lib/access/invitation-lapse.ts does for a store inviter); one that commits later is ordered after the write.

import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { COMPANY_ROLES, companyActor, companyRole, type CompanyRoleKey } from "@/lib/access/company-roles";
import { canActOnCompany } from "@/lib/access/rank";

/** The roles that may act on a target of `targetRank`: strictly higher rank, holding company.people. */
export function actingRoles(targetRank: number): CompanyRoleKey[] {
  return COMPANY_ROLES.filter((r) => canActOnCompany(companyActor(r.key), targetRank, "company.people")).map((r) => r.key);
}

/** True while `actorId` still holds a company role in `companyId` that may act on `targetRank` (owner, or an assignment). */
export function actorMayAct(companyId: SQL, actorId: SQL, targetRank: number, lock = false): SQL {
  const keys = actingRoles(targetRank);
  const share = lock ? sql`for share` : sql``;
  const owner = keys.includes("owner") ? sql`exists (select 1 from companies c where c.id = ${companyId} and c.owner_user_id = ${actorId} ${share})` : sql`false`;
  const held = keys.filter((k) => k !== "owner");
  const assigned =
    held.length > 0
      ? sql`exists (select 1 from role_assignments ra where ra.company_id = ${companyId} and ra.user_id = ${actorId} and ra.role::text in (${sql.join(held.map((k) => sql`${k}`), sql`, `)}) ${share})`
      : sql`false`;
  return sql`(${owner} or ${assigned})`;
}

/** The invitation's inviter could still have made it: whoever held the authority at creation holds it now. Not true: it has lapsed. */
export function inviterMayGrantCompany(companyId: SQL, role: SQL, inviterId: SQL, lock = false): SQL {
  const per = COMPANY_ROLES.filter((r) => r.key !== "owner").map((r) => sql`(${role}::text = ${r.key} and ${actorMayAct(companyId, inviterId, r.rank, lock)})`);
  return sql`(${sql.join(per, sql` or `)})`;
}

/** SQL for a role key column's display name, for event details. */
export function roleNameSql(role: SQL): SQL {
  const cases = COMPANY_ROLES.map((r) => sql`when ${r.key} then ${r.name}`);
  return sql`(case ${role}::text ${sql.join(cases, sql` `)} else ${role}::text end)`;
}

/** The roles whose rank is `rank`: pins a write to the rank the check saw. */
export const rolesAtRank = (rank: number): CompanyRoleKey[] => COMPANY_ROLES.filter((r) => r.rank === rank).map((r) => r.key);
export const rankOf = (key: CompanyRoleKey): number => companyRole(key).rank;
