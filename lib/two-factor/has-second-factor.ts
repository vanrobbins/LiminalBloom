// Whether an account has a second factor, in one place (spec 0.7.1 8; DECISIONS 11-23). "Requires
// two-factor" on a role and the admin rule ask this, never `session.two_factor_at`: a sign-in from a
// trusted device has `two_factor_at = null` and the account still has two-factor. A passkey counts
// (A3c; `passkey()` demands user verification, so it is the device plus a fingerprint or PIN), whether
// or not an authenticator app is on. Better Auth's own challenge looks only at `two_factor_enabled`, so
// a passkey-only account is not asked for a code on password sign-in: accepted (DECISIONS 11-22).

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { hasPasskey } from "@/lib/passkeys/list";

/** True when an authenticator app is turned on (confirmed with a code); a started setup is not it. */
export async function hasAuthenticatorApp(userId: string): Promise<boolean> {
  const [row] = await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId));
  return row?.on === true;
}

/** True when the account has an authenticator app turned on, or a passkey. */
export async function hasSecondFactor(userId: string): Promise<boolean> {
  return (await hasAuthenticatorApp(userId)) || (await hasPasskey(userId));
}
