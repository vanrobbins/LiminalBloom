// What the requester's screens read (spec 0.7.1 9.2). Every query filters by the requester's id by hand: these
// tables are read as the owner with no row-level policy (DECISIONS 11-12), so the filter is the wall. A thread
// that is not theirs is simply not found. Nothing here returns an author id or name: a reply from Liminal Bloom
// is signed "Liminal Bloom", never the admin.

import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { helpMessages, helpRequests } from "@/db/schema";

import { type HelpKind, type HelpStatus, threadId } from "./kinds";

export type HelpListItem = { id: string; kind: HelpKind; status: HelpStatus; firstLine: string; createdAt: string; unread: boolean };
export type ThreadMessage = { id: string; fromAdmin: boolean; body: string; createdAt: string };
export type Thread = { id: string; kind: HelpKind; status: HelpStatus; unread: boolean; messages: ThreadMessage[] };

/** A reply the person has not opened: answered since they last looked (or they never have). */
const isUnread = (status: HelpStatus, updatedAt: Date, seenAt: Date | null) => status === "answered" && (seenAt === null || updatedAt > seenAt);

/** My requests, newest first, each with its first line. */
export async function listRequests(userId: string): Promise<HelpListItem[]> {
  const requests = await db.select().from(helpRequests).where(eq(helpRequests.requesterId, userId)).orderBy(desc(helpRequests.createdAt), desc(helpRequests.id));
  if (requests.length === 0) return [];
  const bodies = await db
    .select({ requestId: helpMessages.requestId, body: helpMessages.body })
    .from(helpMessages)
    .innerJoin(helpRequests, eq(helpRequests.id, helpMessages.requestId))
    .where(eq(helpRequests.requesterId, userId))
    .orderBy(desc(helpMessages.createdAt));
  // Newest first, so the last write per request is its first message.
  const first = new Map<string, string>();
  for (const b of bodies) first.set(b.requestId, b.body);
  return requests.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    firstLine: (first.get(r.id) ?? "").split("\n")[0].trim(),
    createdAt: r.createdAt.toISOString(),
    unread: isUnread(r.status, r.updatedAt, r.requesterSeenAt),
  }));
}

/** One of my threads, oldest message first, or null when there is none with this id that is mine. */
export async function getThread(userId: string, rawId: unknown): Promise<Thread | null> {
  const id = threadId(rawId);
  if (!id) return null;
  const [request] = await db.select().from(helpRequests).where(and(eq(helpRequests.id, id), eq(helpRequests.requesterId, userId)));
  if (!request) return null;
  const messages = await db
    .select({ id: helpMessages.id, fromAdmin: helpMessages.fromAdmin, body: helpMessages.body, createdAt: helpMessages.createdAt })
    .from(helpMessages)
    .where(eq(helpMessages.requestId, request.id))
    .orderBy(asc(helpMessages.createdAt), asc(helpMessages.id));
  return {
    id: request.id,
    kind: request.kind,
    status: request.status,
    unread: isUnread(request.status, request.updatedAt, request.requesterSeenAt),
    messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  };
}
