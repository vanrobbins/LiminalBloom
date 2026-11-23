// The name a store change is logged under (spec 0.7.1 13). Store staff read access_events on Home ("Recent changes"),
// and a company person acts in the store through their company role, with no `member` row there: they appear as the
// company, never by name (DECISIONS 11-11). Someone who is a member of the store acts as themselves. The resolved role
// says which: a company role shows in a store as a synthetic `company:` role (company-roles.ts), and wins only when it
// outranks the person's own member role.

import { isSyntheticRoleId } from "./company-roles";

export type NamedActor = { user: { name: string }; role: { id: string } | null; company: { name: string } | null };

export function storeActorName(member: NamedActor): string {
  return member.company && member.role && isSyntheticRoleId(member.role.id) ? member.company.name : member.user.name;
}
