// Everything two-factor leaves on an account, removed as the statements of one batch (spec 0.7.1 7.1, 7.4):
// the authenticator app and its backup codes, passkeys (a passkey is a second factor too), the flag, every
// session, and the records Better Auth and the app keep in `verification` (trusted devices, the step-up's
// wrong-code count, a passkey add in progress). Used by the admin script's reset for an admin and by the
// admin area's reset for an ordinary account, so the two cannot drift apart.
//
// Without `import "server-only"`: scripts/platform-admin-run.ts runs outside Next.js.

import { and, eq, like, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { passkey, session, twoFactor, user, verification } from "@/db/auth-schema";

/**
 * The statements, in order. `guard`, when given, is ANDed into every one, so a caller can make the whole
 * batch a no-op when a condition stops holding (the admin area's reset passes "not an admin").
 */
export function wipeTwoFactor(userId: string, guard?: SQL) {
  return [
    db.delete(twoFactor).where(and(eq(twoFactor.userId, userId), guard)),
    db.delete(passkey).where(and(eq(passkey.userId, userId), guard)),
    db.update(user).set({ twoFactorEnabled: false }).where(and(eq(user.id, userId), guard)),
    db.delete(session).where(and(eq(session.userId, userId), guard)),
    // Better Auth's trusted-device records hold the user id as their value; the step-up's count is keyed by it.
    db.delete(verification).where(and(or(and(like(verification.identifier, "trust-device-%"), eq(verification.value, userId)), eq(verification.id, `two-factor-failures:${userId}`), like(verification.identifier, `passkey-add:${userId}:%`)), guard)),
  ] as const;
}
