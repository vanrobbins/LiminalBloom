// Setup for database tests of the two-factor code: real Better Auth accounts and their session
// cookies, and the authenticator code a setup key makes. Test code only.

import { randomUUID } from "node:crypto";

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { parseSetCookieHeader } from "better-auth/cookies";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { auth } from "@/lib/auth";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { confirmTwoFactor, startTwoFactor } from "./setup";
import { setupKey } from "./totp-key";

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

/** An account with the authenticator app on (and, with `admin`, a Liminal Bloom admin): its key and the cookie of the session the confirm made, fresh. */
export async function accountWithApp(options: { admin?: boolean } = {}) {
  const account = await makeAccount();
  if (options.admin) await db.insert(platformAdmins).values({ userId: account.userId, addedByName: "test" });
  const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
  if (start.status !== "started") throw new Error(`start refused: ${start.reason}`);
  const key = setupKey(start.otpauthUri)!;
  const done = await confirmTwoFactor(account.cookie, account.userId, await totpFor(key));
  if (done.status !== "on") throw new Error(`confirm refused: ${done.reason}`);
  await Promise.all([clearWrongCodes(account.userId), clearWrongGuesses(account.userId)]);
  return { ...account, key, cookie: cookieHeader(done.responseHeaders) };
}
