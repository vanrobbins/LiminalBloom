// Whether an account has a second factor, in one place (spec 0.7.1 8; DECISIONS 11-23). "Requires
// two-factor" on a role asks this, never `session.two_factor_at`: a sign-in from a trusted device has
// `two_factor_at = null` and the account still has two-factor. A3c adds a passkey to this test.

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";

/** True when the account has an authenticator app turned on (confirmed with a code). */
export async function hasSecondFactor(userId: string): Promise<boolean> {
  const [row] = await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId));
  return row?.on === true;
}
