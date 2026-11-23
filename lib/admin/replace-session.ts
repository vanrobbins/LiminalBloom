// "Use a passkey" at /admin/verify signs in again: Better Auth makes a NEW session (with `two_factor_at`) and
// leaves the one the admin came with, which has no fresh proof, alive next to it. Anyone holding that old
// cookie would still be signed in, so once the new session is in place the old one is deleted. Only the
// browser knows the old id (it asked before the prompt); the server checks it is this account's own, is not the
// new session, and really was stale, so the call cannot sign anyone else out or delete a fresh session.

import "server-only";

import { and, eq, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { sessionTwoFactorAt } from "@/lib/two-factor/fresh-proof";

import { ADMIN_FRESH_MS, isFresh } from "./freshness";

/** Deletes `oldSessionId` when it is another, stale session of the account the request's (fresh) session belongs to. True when it went. */
export async function dropReplacedSession(requestHeaders: Headers, oldSessionId: string): Promise<boolean> {
  const current = await auth.api.getSession({ headers: requestHeaders });
  if (!current || !isFresh(await sessionTwoFactorAt(requestHeaders, current.user.id))) return false;
  const stale = or(isNull(session.twoFactorAt), lt(session.twoFactorAt, new Date(Date.now() - ADMIN_FRESH_MS)));
  const gone = await db
    .delete(session)
    .where(and(eq(session.id, oldSessionId), eq(session.userId, current.user.id), ne(session.id, current.session.id), stale))
    .returning({ id: session.id });
  return gone.length === 1;
}
