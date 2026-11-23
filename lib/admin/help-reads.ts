// What the admin help screens read (spec 0.7.1 7.3, 9.2): the queue and one thread with the requester's name,
// email and the context the server built when they asked. Unlike lib/help/queries.ts these carry names: they
// are for admins only and every page that calls them has awaited its guard. Runs as the table owner.

import "server-only";

import { asc, desc, eq, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { helpMessages, helpRequests } from "@/db/schema";
import { type HelpKind, type HelpStatus, threadId } from "@/lib/help/kinds";

export const QUEUE_LIMIT = 100;

export type AdminHelpItem = { id: string; kind: HelpKind; status: HelpStatus; requesterName: string; firstLine: string; createdAt: Date; updatedAt: Date };
export type AdminHelpMessage = { id: string; fromAdmin: boolean; authorName: string; body: string; createdAt: Date };
export type AdminHelpThread = {
  id: string;
  kind: HelpKind;
  status: HelpStatus;
  closedBy: string | null;
  requesterName: string;
  requesterEmail: string;
  context: Record<string, unknown>;
  createdAt: Date;
  messages: AdminHelpMessage[];
};

const ITEM = {
  id: helpRequests.id,
  kind: helpRequests.kind,
  status: helpRequests.status,
  requesterName: user.name,
  firstLine: sql<string>`split_part(coalesce((select m.body from help_messages m where m.request_id = ${helpRequests.id} order by m.created_at asc, m.id asc limit 1), ''), E'\n', 1)`,
  createdAt: helpRequests.createdAt,
  updatedAt: helpRequests.updatedAt,
};

const section = (status: HelpStatus, order: SQL[]) =>
  db.select(ITEM).from(helpRequests).innerJoin(user, eq(user.id, helpRequests.requesterId)).where(eq(helpRequests.status, status)).orderBy(...order).limit(QUEUE_LIMIT);

/** Open oldest first (the one waiting longest on top), then Replied and Closed, newest activity first. */
export async function adminHelpList(): Promise<{ open: AdminHelpItem[]; replied: AdminHelpItem[]; closed: AdminHelpItem[] }> {
  const [open, replied, closed] = await Promise.all([
    section("open", [asc(helpRequests.createdAt), asc(helpRequests.id)]),
    section("answered", [desc(helpRequests.updatedAt), asc(helpRequests.id)]),
    section("closed", [desc(helpRequests.updatedAt), asc(helpRequests.id)]),
  ]);
  return { open, replied, closed };
}

/** One request with its thread, or null when the id is not a request. */
export async function adminHelpThread(rawId: unknown): Promise<AdminHelpThread | null> {
  const id = threadId(rawId);
  if (!id) return null;
  const [request] = await db
    .select({ r: helpRequests, name: user.name, email: user.email })
    .from(helpRequests)
    .innerJoin(user, eq(user.id, helpRequests.requesterId))
    .where(eq(helpRequests.id, id));
  if (!request) return null;
  const messages = await db
    .select({ id: helpMessages.id, fromAdmin: helpMessages.fromAdmin, authorName: helpMessages.authorName, body: helpMessages.body, createdAt: helpMessages.createdAt })
    .from(helpMessages)
    .where(eq(helpMessages.requestId, id))
    .orderBy(asc(helpMessages.createdAt), asc(helpMessages.id));
  const { r } = request;
  return { id: r.id, kind: r.kind, status: r.status, closedBy: r.closedBy, requesterName: request.name, requesterEmail: request.email, context: r.context, createdAt: r.createdAt, messages };
}
