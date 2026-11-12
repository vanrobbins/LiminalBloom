// Builders for the People screen's tests: a view with the people a store might have.

import type { InvitationRow, PeopleView, PersonRow, RoleChoice } from "@/lib/access/people-view";
import { groupByRole } from "@/lib/access/people-view";

export const ROLES: RoleChoice[] = [
  { id: "r-am", name: "Assistant Manager", rank: 200 },
  { id: "r-vmw", name: "Visual Merchandising Worker", rank: 400 },
  { id: "r-sa", name: "Sales Associate", rank: 500 },
];

export const person = (name: string, roleId: string, roleName: string, rank: number, extra: Partial<PersonRow> = {}): PersonRow => ({
  memberId: `m-${name.replace(/\s/g, "")}`,
  name,
  email: null,
  roleId,
  roleName,
  rank,
  isYou: false,
  canAct: false,
  ...extra,
});

export const invitationRow = (email: string, extra: Partial<InvitationRow> = {}): InvitationRow => {
  const canAct = extra.canAct ?? true;
  return { id: canAct ? `i-${email}` : null, email, roleName: "Sales Associate", expiresAt: "2026-11-13T23:40:00.000Z", expired: false, lapsed: false, canAct, linkWorks: true, ...extra };
};

export function viewOf(people: PersonRow[], extra: Partial<PeopleView> = {}): PeopleView {
  return { canManage: false, groups: groupByRole(people), invitations: [], assignable: [], isSoleManager: false, ...extra };
}
