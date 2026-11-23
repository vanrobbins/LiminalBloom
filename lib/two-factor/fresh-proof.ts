// A stolen session plus the password must not be able to change an admin's second factor (a new app, new
// backup codes, a new passkey) and so skip the 12-hour step-up. For a Liminal Bloom admin who already has
// any second factor, changing it asks for a session that passed one inside 12 hours (the same rule as /admin);
// the refusal sends them to /admin/verify. An admin with none yet is who sets the first one up, so is let through.
// Non-admins are not asked: nothing outside /admin has a step-up, and a trusted-device sign-in has no
// `two_factor_at` while the account still has two-factor (DECISIONS 11-23).

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { isFresh } from "@/lib/admin/freshness";
import { isPlatformAdmin } from "@/lib/admin/is-admin";
import { auth } from "@/lib/auth";

import { hasSecondFactor } from "./has-second-factor";

/** When this request's session (of this account) last passed a second factor, or null. */
export async function sessionTwoFactorAt(requestHeaders: Headers, userId: string): Promise<Date | null> {
  const current = await auth.api.getSession({ headers: requestHeaders });
  if (!current || current.user.id !== userId) return null;
  const [row] = await db.select({ at: session.twoFactorAt }).from(session).where(eq(session.id, current.session.id));
  return row?.at ?? null;
}

/** True when this account is an admin with a second factor and the request's session has no fresh proof of one. */
export async function needsFreshProof(requestHeaders: Headers, userId: string): Promise<boolean> {
  if (!(await isPlatformAdmin(userId)) || !(await hasSecondFactor(userId))) return false;
  return !isFresh(await sessionTwoFactorAt(requestHeaders, userId));
}
