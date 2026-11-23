// What the admin screens read (spec 0.7.1 7.3): the overview, the activity list and the stores. Account-level
// facts only: names, emails, roles, counts, dates. Never a store's own data (spec 7.6; the scan in
// app/admin/no-store-data.test.ts keeps `withStore` and the data libraries out of this folder).
//
// Runs as the table owner, because the store role cannot read these tables (migration 0020). Nothing here
// authorises anything: every page that calls these has already awaited a guard from ./guard.ts, and every
// query that takes an id filters by it by hand. The people lookup is in ./reads-people.ts.

import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member, organization, user } from "@/db/auth-schema";
import { helpRequests, platformEvents, roleDefinitions, storeSuspensions } from "@/db/schema";

export type AdminEvent = { id: string; actorName: string; action: string; targetKind: string; targetLabel: string; reason: string; createdAt: Date };

const EVENT = { id: platformEvents.id, actorName: platformEvents.actorName, action: platformEvents.action, targetKind: platformEvents.targetKind, targetLabel: platformEvents.targetLabel, reason: platformEvents.reason, createdAt: platformEvents.createdAt };

/** What `/admin` shows: help waiting (open requests, spec 7.3) and the last 10 events. */
export async function adminOverview(): Promise<{ helpWaiting: number; events: AdminEvent[] }> {
  const [[waiting], events] = await Promise.all([
    db.select({ n: count() }).from(helpRequests).where(eq(helpRequests.status, "open")),
    db.select(EVENT).from(platformEvents).orderBy(desc(platformEvents.createdAt)).limit(10),
  ]);
  return { helpWaiting: waiting.n, events };
}

/** The newest `limit` events, optionally of one kind; `hasMore` says whether a larger limit would show more. */
export async function recentEvents({ limit, kind }: { limit: number; kind?: string }): Promise<{ events: AdminEvent[]; hasMore: boolean }> {
  const rows = await db
    .select(EVENT)
    .from(platformEvents)
    .where(kind ? eq(platformEvents.action, kind) : undefined)
    .orderBy(desc(platformEvents.createdAt))
    .limit(limit + 1);
  return { events: rows.slice(0, limit), hasMore: rows.length > limit };
}

export type StoreRow = { id: string; name: string; createdAt: Date; people: number; managers: string[]; paused: boolean };

const MAX_STORES = 500;

/** Every store: name, created, people count, Store Managers' names, paused. Companies join the list in 0.7.1b. */
export async function listStores(): Promise<StoreRow[]> {
  const stores = await db
    .select({ id: organization.id, name: organization.name, createdAt: organization.createdAt, paused: storeSuspensions.storeId })
    .from(organization)
    .leftJoin(storeSuspensions, eq(storeSuspensions.storeId, organization.id))
    .orderBy(asc(organization.name), asc(organization.id))
    .limit(MAX_STORES);
  if (stores.length === 0) return [];
  const ids = stores.map((s) => s.id);
  const [counts, managers] = await Promise.all([
    db.select({ storeId: member.organizationId, n: count() }).from(member).where(inArray(member.organizationId, ids)).groupBy(member.organizationId),
    db
      .select({ storeId: member.organizationId, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .innerJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId), eq(roleDefinitions.builtin, "store_manager")))
      .where(inArray(member.organizationId, ids))
      .orderBy(asc(user.name)),
  ]);
  const people = new Map(counts.map((c) => [c.storeId, c.n]));
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    people: people.get(s.id) ?? 0,
    managers: managers.filter((m) => m.storeId === s.id).map((m) => m.name),
    paused: s.paused !== null,
  }));
}

export type StorePerson = { userId: string; name: string; email: string; roleName: string | null };
export type StoreInvitation = { id: string; email: string; roleName: string | null; expiresAt: Date; expired: boolean };
export type StoreDetail = {
  id: string;
  name: string;
  createdAt: Date;
  pause: { reason: string; byName: string; since: Date } | null;
  people: StorePerson[];
  invitations: StoreInvitation[];
};

/** One store's people (name, email, role) and pending invitations, or null when there is no such store. */
export async function storeDetail(storeId: string, now: Date = new Date()): Promise<StoreDetail | null> {
  const [store] = await db.select({ id: organization.id, name: organization.name, createdAt: organization.createdAt }).from(organization).where(eq(organization.id, storeId));
  if (!store) return null;
  const [pause, people, invitations] = await Promise.all([
    db.select({ reason: storeSuspensions.reason, byName: storeSuspensions.suspendedByName, since: storeSuspensions.createdAt }).from(storeSuspensions).where(eq(storeSuspensions.storeId, storeId)),
    db
      .select({ userId: user.id, name: user.name, email: user.email, roleName: roleDefinitions.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, member.organizationId), eq(roleDefinitions.id, member.roleId)))
      .where(eq(member.organizationId, storeId))
      // A person with no role sorts last (null rank).
      .orderBy(asc(roleDefinitions.rank), asc(user.name)),
    db
      .select({ id: invitation.id, email: invitation.email, roleName: roleDefinitions.name, expiresAt: invitation.expiresAt })
      .from(invitation)
      .leftJoin(roleDefinitions, and(eq(roleDefinitions.storeId, invitation.organizationId), eq(roleDefinitions.id, invitation.roleId)))
      .where(and(eq(invitation.organizationId, storeId), eq(invitation.status, "pending")))
      .orderBy(desc(invitation.createdAt)),
  ]);
  return {
    ...store,
    pause: pause[0] ?? null,
    people,
    invitations: invitations.map((i) => ({ ...i, expired: i.expiresAt <= now })),
  };
}
