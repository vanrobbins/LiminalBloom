// What the password change does after Better Auth's own `changePassword` (0.7.0 task 11 review).
//
// Better Auth's call starts the new session with the 7-day expiry even when the person
// signed in without "Keep me signed in": the cookie stays browser-length (the
// `dont_remember` cookie is read from the request) but the row would outlive it. So when
// the request carries that cookie, the new session row is cut back to a day, as a sign-in
// without "Keep me signed in" makes it. Only ever shortens, so the cookie's signature is
// not checked: a forged one can only ask for a shorter session.
//
// The new session's active store needs no code here: the session-create hook in lib/auth.ts
// picks the person's remembered store, and lib/change-password.db.test.ts proves it.

import "server-only";

import { parseCookies } from "better-auth/cookies";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

const SHORT_SESSION_MS = 24 * 3_600_000;

/** Shortens the new session (found by its token) to 24 hours if the request came from a sign-in without "Keep me signed in". */
export async function keepShortSessionShort(token: string, request: Headers): Promise<void> {
  const { name } = (await auth.$context).authCookies.dontRememberToken;
  if (!parseCookies(request.get("cookie") ?? "").has(name)) return;
  await db
    .update(session)
    .set({ expiresAt: new Date(Date.now() + SHORT_SESSION_MS) })
    .where(eq(session.token, token));
}
