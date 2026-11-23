// A real session row for tests that switch stores (setActiveStore writes to it). Deleted with its person.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/auth-schema";

/** A session for `userId`, working in `active` (a store id or null). Returns its id. */
export async function makeSession(userId: string, active: string | null = null): Promise<string> {
  const id = `test_sess_${randomUUID().slice(0, 8)}`;
  await db.insert(session).values({ id, userId, token: id, expiresAt: new Date(Date.now() + 60_000), activeStoreId: active });
  return id;
}

/** The store the session row names. */
export async function sessionStore(sessionId: string): Promise<string | null> {
  return (await db.select({ active: session.activeStoreId }).from(session).where(eq(session.id, sessionId)))[0]?.active ?? null;
}
