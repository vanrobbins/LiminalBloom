// "Trust this device for 30 days" (spec 0.7.1 8.3, A3b). In Better Auth 1.7.27 a trusted device is a signed
// cookie PLUS a row in the `verification` table (identifier `trust-device-...`, value the user's id): the
// sign-in honours the cookie only while that row exists and is unexpired
// (node_modules/better-auth/dist/plugins/two-factor/index.mjs, readSignInTwoFactorState). Its own turn-off
// deletes only the row of the cookie the request carries, so every OTHER device stays trusted for the rest
// of its 30 days. Deleting the person's rows is what forgets them all.

import "server-only";

import { and, eq, like } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/auth-schema";

/** Forgets every trusted device of the account: each one asks for a code again at its next sign-in. */
export async function forgetTrustedDevices(userId: string): Promise<void> {
  await db.delete(verification).where(and(eq(verification.value, userId), like(verification.identifier, "trust-device-%")));
}
