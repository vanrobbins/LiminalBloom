// Which store a session opens in (docs/DECISIONS.md, 2026-09-29).
//
// A person can belong to several stores. Signing in opens the one they used
// last, as long as they still belong to it; otherwise the one they joined
// first; otherwise none, and they are sent to create one.
//
// Server only in practice, but deliberately without `import "server-only"`:
// lib/auth.ts imports this file, and the Better Auth CLI loads lib/auth.ts
// outside Next.js to generate the schema, where that import throws.

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";

/** The store to make active for this person, or null if they have none. */
export async function chooseActiveStore(
  userId: string,
): Promise<string | null> {
  const memberships = await db
    .select({ storeId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt));

  if (memberships.length === 0) {
    return null;
  }

  const [person] = await db
    .select({ lastActiveStoreId: user.lastActiveStoreId })
    .from(user)
    .where(eq(user.id, userId));

  // Only honour the remembered store if they still belong to it. A store
  // they have left, or one that was deleted, must never become active.
  const remembered = person?.lastActiveStoreId;
  if (remembered && memberships.some((m) => m.storeId === remembered)) {
    return remembered;
  }

  return memberships[0].storeId;
}

/**
 * The store a request may act in: the session's active store, but only while
 * the person still belongs to it. Otherwise the same choice sign-in makes.
 *
 * Every page that reads store data, and anything that encrypts or decrypts
 * for a store, uses this rather than the session's value directly. Removing
 * someone from a store only clears the active store on the remover's own
 * session, so the removed person's other sessions still name it.
 */
export async function resolveActiveStore(
  userId: string,
  sessionStoreId: string | null | undefined,
): Promise<string | null> {
  if (sessionStoreId) {
    const [membership] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(eq(member.userId, userId), eq(member.organizationId, sessionStoreId)),
      );

    if (membership) {
      return sessionStoreId;
    }
  }

  return chooseActiveStore(userId);
}

/** Record the store this person is now working in. */
export async function rememberActiveStore(
  userId: string,
  storeId: string,
): Promise<void> {
  await db
    .update(user)
    .set({ lastActiveStoreId: storeId })
    .where(eq(user.id, userId));
}
