// The Roles screen's data (spec 0.7, 4.8 part 1): every role in rank order with what
// the viewer may do to it, who holds each custom role, and the latest access events.
// Runs as the table owner (the store role cannot read Better Auth's tables), with
// every query filtered by the viewer's active store by hand.

import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { accessEvents, roleDefinitions } from "@/db/schema";
import type { Member } from "@/lib/current-member";
import { byName } from "@/lib/natural-sort";

import { can } from "./can";
import { actorOf } from "./people";
import { activityText } from "./roles-activity";
import { buildRoleRows, type ActivityLine, type RoleInput, type RolesView } from "./roles-view";
import { cleanSwitches } from "./switches";

const ACTIVITY_LIMIT = 20;

async function readPeopleOf(storeId: string, roleIds: string[]) {
  if (roleIds.length === 0) return { named: [], pending: [] };
  const [named, pending] = await Promise.all([
    db.select({ roleId: member.roleId, name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.organizationId, storeId), inArray(member.roleId, roleIds))),
    db
      .select({ roleId: invitation.roleId, n: sql<number>`count(*)::int` })
      .from(invitation)
      .where(and(eq(invitation.organizationId, storeId), eq(invitation.status, "pending"), inArray(invitation.roleId, roleIds)))
      .groupBy(invitation.roleId),
  ]);
  return { named, pending };
}

export async function rolesViewFor(viewer: Member): Promise<RolesView> {
  const storeId = viewer.activeStoreId;
  const actor = actorOf(viewer);
  const [roles, events] = await Promise.all([
    db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).orderBy(asc(roleDefinitions.rank)),
    db.select().from(accessEvents).where(eq(accessEvents.storeId, storeId)).orderBy(desc(accessEvents.createdAt)).limit(ACTIVITY_LIMIT),
  ]);
  // Built-ins can't be deleted, so only custom roles need to say who holds them.
  const { named, pending } = await readPeopleOf(storeId, roles.filter((r) => r.builtin === null).map((r) => r.id));
  const input: RoleInput[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    rank: r.rank,
    builtin: r.builtin,
    version: r.version,
    switches: r.switches,
    people: { names: byName(named.filter((p) => p.roleId === r.id).map((p) => ({ name: p.name }))).map((p) => p.name), invitations: pending.find((p) => p.roleId === r.id)?.n ?? 0 },
  }));
  const canSeeEmails = can(viewer, "people.manage");
  const activity: ActivityLine[] = events.map((e) => ({ id: e.id, text: activityText(e.event, e.actorName, e.detail, canSeeEmails), at: e.createdAt.toISOString() }));
  const placements = roles.filter((r) => r.rank >= actor.rank).map((r) => ({ id: r.id, name: r.name }));
  return {
    roles: buildRoleRows(input, actor, viewer.role?.id ?? null),
    holds: [...cleanSwitches(viewer.switches)],
    canMovePeople: can(viewer, "people.manage"),
    placements,
    activity,
  };
}

