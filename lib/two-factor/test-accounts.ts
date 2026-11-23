// Setup for database tests of the two-factor code: real Better Auth accounts and their session
// cookies, and the authenticator code a setup key makes. Test code only.

import { randomUUID } from "node:crypto";

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { parseSetCookieHeader } from "better-auth/cookies";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export const TEST_PASSWORD = "test-password-1";

const created: string[] = [];

/** The Cookie header a browser would send back for a response's Set-Cookie. */
export function cookieHeader(responseHeaders: Headers, extra: string[] = []): Headers {
  const jar = [...parseSetCookieHeader(responseHeaders.get("set-cookie") ?? "").entries()].map(([name, c]) => `${name}=${c.value}`);
  return new Headers({ cookie: [...jar, ...extra].join("; ") });
}

/** A new account, signed in once: its id, email and the cookie of that session. */
export async function makeAccount() {
  const email = `test_2fa_${randomUUID().slice(0, 8)}@example.com`;
  const { headers, response } = await auth.api.signUpEmail({ body: { name: "Two Factor Test", email, password: TEST_PASSWORD }, returnHeaders: true });
  created.push(response.user.id);
  return { userId: response.user.id, email, cookie: cookieHeader(headers) };
}

/** Another session for the same account (a second device). */
export async function signInAgain(email: string): Promise<Headers> {
  return cookieHeader((await auth.api.signInEmail({ body: { email, password: TEST_PASSWORD }, returnHeaders: true })).headers);
}

export async function dropAccounts() {
  for (const id of created.splice(0)) await db.delete(user).where(eq(user.id, id));
}

/** The authenticator code for a setup key (the otpauth link's base32 secret) right now. */
export const totpFor = (key: string) => createOTP(base32.decode(key)).totp();
