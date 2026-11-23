// The reply count behind the avatar dot and "Help · N replies" (spec 0.7.1 9.2): requests Liminal Bloom has
// answered since the person last opened them. One count on the (requester_id, status) index; getCurrentMember
// asks for it once per request. Read as the owner, filtered by the person's id.

import "server-only";

import { and, count, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { helpRequests } from "@/db/schema";

export async function helpRepliesFor(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(helpRequests)
    .where(and(eq(helpRequests.requesterId, userId), eq(helpRequests.status, "answered"), or(isNull(helpRequests.requesterSeenAt), gt(helpRequests.updatedAt, helpRequests.requesterSeenAt))));
  return Number(row?.n ?? 0);
}
