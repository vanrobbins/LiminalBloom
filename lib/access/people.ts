// Who is in the store, for the People screen (spec 0.7, 4.8). Everyone in a store
// sees every person and role in it (4.3); only someone with people.manage also
// sees emails and the pending invitations. That is decided here, on the server,
// so a read-only viewer is never sent an address they can't see.
//
// Runs as the table owner, not through withStore: the store role cannot read
// Better Auth's tables. Every query is filtered by the store id by hand, and the
// store id is the member's active store (lib/current-member.ts), never a request's.

import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import type { Member } from "@/lib/current-member";

import { can } from "./can";
import { canActOn, type Actor } from "./rank";
import { groupByRole, NO_ROLE_NAME, NO_ROLE_RANK, type InvitationRow, type PeopleView, type PersonRow, type RoleChoice } from "./people-view";

/** The viewer as the rank rule sees them. A member with no role has no rank, so the rule refuses everything. */
export function actorOf(viewer: Member): Actor {
  return { rank: viewer.role?.rank ?? Number.NaN, switches: new Set(viewer.switches) };
}

async function readPeople(storeId: string) {
  return db
    .select({
      memberId: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      roleId: member.roleId,
      roleName: roleDefinitions.name,
      rank: roleDefinitions.rank,
      builtin: roleDefinitions.builtin,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
    .where(eq(member.organizationId, storeId));
}

async function readInvitations(storeId: string) {
  return db
    .select({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt, roleName: roleDefinitions.name, rank: roleDefinitions.rank })
    .from(invitation)
    .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, invitation.organizationId), eq(roleDefinitions.id, invitation.roleId)))
    .where(and(eq(invitation.organizationId, storeId), eq(invitation.status, "pending")))
    .orderBy(desc(invitation.createdAt));
}

async function readRoles(storeId: string): Promise<RoleChoice[]> {
  return db.select({ id: roleDefinitions.id, name: roleDefinitions.name, rank: roleDefinitions.rank }).from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).orderBy(asc(roleDefinitions.rank));
}

export async function peopleViewFor(viewer: Member, now: Date = new Date()): Promise<PeopleView> {
  const storeId = viewer.activeStoreId;
  const canManage = can(viewer, "people.manage");
  const actor = actorOf(viewer);
  const [people, pending, roles] = await Promise.all([readPeople(storeId), canManage ? readInvitations(storeId) : [], canManage ? readRoles(storeId) : []]);

  const rows: PersonRow[] = people.map((p) => {
    const rank = p.rank ?? NO_ROLE_RANK;
    const isYou = p.userId === viewer.user.id;
    return {
      memberId: p.memberId,
      name: p.name,
      email: canManage ? p.email : null,
      roleId: p.roleId,
      roleName: p.roleName ?? NO_ROLE_NAME,
      rank,
      isYou,
      canAct: !isYou && canActOn(actor, rank, "people.manage"),
    };
  });
  const managers = people.filter((p) => p.builtin === "store_manager");
  const invitations: InvitationRow[] = pending.map((i) => {
    const canAct = canActOn(actor, i.rank ?? NO_ROLE_RANK, "people.manage");
    // The id is the invite link (/invite/<id>), so only someone who may act on the row is sent it.
    return { id: canAct ? i.id : null, email: i.email, roleName: i.roleName ?? NO_ROLE_NAME, expiresAt: i.expiresAt.toISOString(), expired: i.expiresAt <= now, canAct, linkWorks: i.roleName !== null };
  });

  return {
    canManage,
    groups: groupByRole(rows),
    invitations,
    assignable: roles.filter((r) => canActOn(actor, r.rank, "people.manage")),
    isSoleManager: managers.length === 1 && managers[0].userId === viewer.user.id,
  };
}
