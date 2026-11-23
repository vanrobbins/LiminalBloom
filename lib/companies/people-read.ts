// What /company's People and Ownership show (spec 0.7.1 6.2, 6.5, 13): the owner, the corporate admins and regional
// managers with their emails, and the waiting company invitations. Only for a holder of company.people (the page
// asks), read as the table owner with the company id from the person's own access. A row carries `canAct` by the
// rank rule (strictly lower than the viewer's own), and an invitation's id, which is its link, only when the viewer
// may act on it. Expired and lapsed invitations are dead and not listed (a new invitation cancels them).

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { canAssignCompanyRole, COMPANY_ROLES, companyRole, type AssignableCompanyRoleKey, type CompanyRoleKey } from "@/lib/access/company-roles";
import type { CompanyAccess } from "@/lib/access/resolve-merge";

import { inviterMayGrantCompany } from "./authority";

export type PersonRow = { userId: string; name: string; email: string; role: CompanyRoleKey; roleName: string; regionId: string | null; regionName: string | null; version: number; canAct: boolean };
export type CompanyInvitationRow = { id: string | null; email: string; roleName: string; regionName: string | null; expiresAt: string };
export type CompanyPeople = { people: PersonRow[]; invitations: CompanyInvitationRow[]; /** The company's `version`, which a hand-off is pinned to. */ version: number };

type Row = Record<string, unknown>;

/** The roles the viewer may invite into, top first: strictly below their own. */
export const assignableRoles = (viewer: CompanyRoleKey) => COMPANY_ROLES.filter((r) => canAssignCompanyRole(viewer, r.key)).map((r) => ({ key: r.key as AssignableCompanyRoleKey, name: r.name }));

export async function companyPeople(company: CompanyAccess, viewerId: string, now: Date = new Date()): Promise<CompanyPeople> {
  const [[head], assigned, invites] = await Promise.all([
    db.execute<Row>(sql`select c.version, u.id, u.name, u.email from companies c join "user" u on u.id = c.owner_user_id where c.id = ${company.id}`).then((r) => r.rows),
    db
      .execute<Row>(sql`
        select u.id, u.name, u.email, ra.role::text as role, ra.region_id, g.name as region_name, ra.version
        from role_assignments ra join "user" u on u.id = ra.user_id left join regions g on g.id = ra.region_id
        where ra.company_id = ${company.id} order by ra.role, lower(u.name), u.id`)
      .then((r) => r.rows),
    db
      .execute<Row>(sql`
        select i.id, i.email, i.role::text as role, g.name as region_name, i.expires_at
        from company_invitations i left join regions g on g.id = i.region_id
        where i.company_id = ${company.id} and i.status = 'pending' and i.expires_at > ${now.toISOString()}::timestamptz
          and ${inviterMayGrantCompany(sql`i.company_id`, sql`i.role`, sql`i.inviter_id`)}
        order by i.created_at desc`)
      .then((r) => r.rows),
  ]);
  const owner: PersonRow[] = head ? [{ userId: String(head.id), name: String(head.name), email: String(head.email), role: "owner", roleName: companyRole("owner").name, regionId: null, regionName: null, version: 0, canAct: false }] : [];
  const people = assigned.map((r): PersonRow => {
    const role = r.role as AssignableCompanyRoleKey;
    return {
      userId: String(r.id),
      name: String(r.name),
      email: String(r.email),
      role,
      roleName: companyRole(role).name,
      regionId: r.region_id ? String(r.region_id) : null,
      regionName: r.region_name ? String(r.region_name) : null,
      version: Number(r.version),
      canAct: String(r.id) !== viewerId && canAssignCompanyRole(company.role, role),
    };
  });
  const invitations = invites.map((r): CompanyInvitationRow => {
    const role = r.role as AssignableCompanyRoleKey;
    return { id: canAssignCompanyRole(company.role, role) ? String(r.id) : null, email: String(r.email), roleName: companyRole(role).name, regionName: r.region_name ? String(r.region_name) : null, expiresAt: new Date(String(r.expires_at)).toISOString() };
  });
  return { people: [...owner, ...people], invitations, version: head ? Number(head.version) : 0 };
}
