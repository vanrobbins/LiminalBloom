// Moves the store a session works in (spec 0.7.1, 4.3). The store must be one the person reaches today
// (resolveAccess, which applies the company and pause filters); only then are two columns written together:
// the session's `active_store_id` and the person's `last_active_store_id`. The second is how the choice
// survives: a session made later (password change, two-factor confirm, passkey) gets its store only from the
// sign-in hook, which reads that column. `/organization/set-active` is closed, so this is the one way in.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { session, user } from "@/db/auth-schema";

import { resolveAccess } from "./resolve";

export type SetActiveOutcome = { status: "switched" | "forbidden" };

export async function setActiveStore(sessionId: string, userId: string, storeId: string): Promise<SetActiveOutcome> {
  const access = await resolveAccess(userId, { activeStoreId: storeId });
  // resolveAccess falls back to another store when the one asked for is not reachable: it must be this one.
  if (access.activeStoreId !== storeId) return { status: "forbidden" };
  await db.batch([
    db.update(session).set({ activeStoreId: storeId }).where(and(eq(session.id, sessionId), eq(session.userId, userId))),
    db.update(user).set({ lastActiveStoreId: storeId }).where(eq(user.id, userId)),
  ]);
  return { status: "switched" };
}
