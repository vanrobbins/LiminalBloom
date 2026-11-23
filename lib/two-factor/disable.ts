// Turning two-factor off for an account: the password and a current authenticator code, the way turning
// it on asked for the password and a first code (spec 0.7.1 8.3, A3b). Better Auth's browser route is
// closed (lib/auth-closed-paths.ts), so this is the only way, and `auth.api.disableTwoFactor` is called
// with the caller's session. A0 (8.4) and the source: it deletes the factor, starts a NEW session in place
// of this one and sets cookies (it also forgets this device's trusted-device mark), so the cookies are
// carried back and the new session is cut to a day if the sign-in was without "Keep me signed in".
//
// With a session present Better Auth counts no wrong codes and `auth.api` skips its HTTP limiter, so both
// tries are counted here: the code under the step-up's counter, the password under the password counter.
// A Liminal Bloom admin can't turn it off (spec 8.2).

import "server-only";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { auth } from "@/lib/auth";
import { keepShortSessionShort } from "@/lib/change-password";
import { claimCodeGuess, clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { claimGuess, clearWrongGuesses } from "@/lib/password-guesses";

import { newSessionToken } from "./setup";

export type DisableReply = { status: "off"; responseHeaders: Headers } | { status: "refused"; reason: "password" | "code" | "locked" | "not-on" | "admin" | "failed" };

const codeOf = (error: unknown) => (error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined);

export async function disableTwoFactor(requestHeaders: Headers, userId: string, password: string, code: string): Promise<DisableReply> {
  const [admin] = await db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId));
  if (admin) return { status: "refused", reason: "admin" };

  // The code first, so a wrong one never spends a password try.
  if (!(await claimCodeGuess(userId))) return { status: "refused", reason: "locked" };
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: requestHeaders });
  } catch (error) {
    const found = codeOf(error);
    if (found === "INVALID_CODE") return { status: "refused", reason: "code" };
    return { status: "refused", reason: found === "TOTP_NOT_ENABLED" ? "not-on" : "failed" };
  }
  if (!(await claimGuess(userId))) return { status: "refused", reason: "locked" };
  let responseHeaders: Headers;
  try {
    responseHeaders = (await auth.api.disableTwoFactor({ body: { password }, headers: requestHeaders, returnHeaders: true })).headers;
  } catch (error) {
    return { status: "refused", reason: codeOf(error) === "INVALID_PASSWORD" ? "password" : "failed" };
  }
  // It is off: nothing below may fail the change, or the person would be told it failed and, without the cookie, signed out.
  try {
    await Promise.all([clearWrongCodes(userId), clearWrongGuesses(userId)]);
    const token = await newSessionToken(responseHeaders);
    if (token) await keepShortSessionShort(token, requestHeaders);
  } catch (error) {
    console.error("two-factor turn off: follow-up steps failed", error);
  }
  return { status: "off", responseHeaders };
}
