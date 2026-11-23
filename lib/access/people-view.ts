// What the People screen is given (spec 0.7, 4.8): pure types and grouping, free
// of server-only code so the screen's components can import them. Built on the
// server by lib/access/people.ts; the server decides who sees emails and which
// rows have buttons, so a read-only viewer is never sent what they can't see.

import { byName } from "@/lib/natural-sort";

/** The rank of a member or invitation with no role: below every real role, so any manager may reach it. */
export const NO_ROLE_RANK = Number.MAX_SAFE_INTEGER;
export const NO_ROLE_NAME = "No role";

export type PersonRow = {
  memberId: string;
  name: string;
  /** Only for someone who may manage people; null for everyone else. */
  email: string | null;
  roleId: string | null;
  roleName: string;
  rank: number;
  isYou: boolean;
  /** Whether the viewer may change this person's role or remove them (the rank rule, decided on the server). */
  canAct: boolean;
};

export type InvitationRow = {
  /** The id is the invite link (/invite/<id>), so it is null unless the viewer may act on this invitation (`canAct`). */
  id: string | null;
  email: string;
  roleName: string;
  /** ISO text, so it crosses into client components. */
  expiresAt: string;
  expired: boolean;
  /** The inviter can no longer grant this role (left, re-roled below it, lost people.manage): dead like an expired one, so only Cancel is offered. */
  lapsed: boolean;
  canAct: boolean;
  /** False for an invitation made before roles existed (no role): its link opens as "missing", so only Cancel is offered. */
  linkWorks: boolean;
};

export type RoleChoice = { id: string; name: string; rank: number };

export type RoleGroup = { key: string; roleName: string; rank: number; people: PersonRow[] };

/** A regional manager of the store's region (company people, spec 0.7.1 6.6). Names for everyone in the store; `email` only with people.manage. */
export type RegionalManagerRow = { name: string; email: string | null; isYou: boolean };

export type PeopleView = {
  canManage: boolean;
  /** The company's regional managers for this store's region. Empty for a standalone store. */
  regionalManagers: RegionalManagerRow[];
  groups: RoleGroup[];
  /** Empty unless the viewer may manage people. */
  invitations: InvitationRow[];
  /** The roles the viewer may give someone: those ranked below theirs. Empty without `people.manage`. */
  assignable: RoleChoice[];
  /** The viewer is the only Store Manager (spec 4.8 part 2). */
  isSoleManager: boolean;
  /** Someone in the store holds Store Manager. False shows "No Store Manager yet." under the title (spec 0.7.1 6.6). */
  hasStoreManager: boolean;
};

/** Highest rank first (smaller number), people A to Z within a role. People without a role make the last group. */
export function groupByRole(rows: readonly PersonRow[]): RoleGroup[] {
  const groups = new Map<string, RoleGroup>();
  for (const row of rows) {
    const key = row.roleId ?? "none";
    const group = groups.get(key) ?? { key, roleName: row.roleName, rank: row.rank, people: [] };
    group.people.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.rank - b.rank).map((g) => ({ ...g, people: byName(g.people) }));
}

/** The Store panel's one list (11-22, Van): the viewer first, then everyone else in the groups' order (rank, then A to Z). */
export function peopleInOrder(groups: readonly RoleGroup[]): PersonRow[] {
  const everyone = groups.flatMap((g) => g.people);
  return [...everyone.filter((p) => p.isYou), ...everyone.filter((p) => !p.isYou)];
}
