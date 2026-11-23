// Turning two-factor on, shared by everyone who can (admins now; any account in A3b): start with the
// password, confirm with a code, ask for new backup codes. Each takes the request's headers (the caller's
// session cookie) and the person's id and answers with an outcome; the server actions around them
// (app/admin/two-factor/actions.ts) guard first and carry the cookies to the browser. Spec 0.7.1 8.3,
// proved in A0 (8.4 items 2): `enableTwoFactor` sets no cookie and swaps nothing; the first correct
// `verifyTOTP` turns it on, swaps the session (the hook sets `two_factor_at`) and sets one cookie.
//
// Better Auth's browser routes for all of this are closed (lib/auth-closed-paths.ts); these call
// `auth.api`, which skips its HTTP rate limiter, so a wrong password is counted here, as the password
// change does (lib/password-guesses.ts).

import "server-only";

import { APIError } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { keepShortSessionShort } from "@/lib/change-password";
import { clearWrongGuesses, recordWrongGuess, tooManyGuesses } from "@/lib/password-guesses";

import { setupKey } from "./totp-key";

const ISSUER = "Liminal Bloom";

export type StartReply =
  | { status: "started"; otpauthUri: string; setupKey: string; backupCodes: string[] }
  | { status: "refused"; reason: "password" | "locked" | "already-on" | "failed" };
export type ConfirmReply = { status: "on"; responseHeaders: Headers } | { status: "refused"; reason: "code" | "already-on" | "failed" };
export type CodesReply = { status: "codes"; backupCodes: string[] } | { status: "refused"; reason: "password" | "locked" | "not-on" | "failed" };

const codeOf = (error: unknown) => (error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined);

/** Step 1: checks the password (a wrong one is counted) and stores a new unverified secret with ten backup codes. Calling it again before confirming starts over. */
export async function startTwoFactor(requestHeaders: Headers, userId: string, password: string): Promise<StartReply> {
  if (await tooManyGuesses(userId)) return { status: "refused", reason: "locked" };
  try {
    const result = await auth.api.enableTwoFactor({ body: { password, issuer: ISSUER }, headers: requestHeaders });
    const key = "totpURI" in result ? setupKey(result.totpURI) : null;
    if (!("totpURI" in result) || !key) return { status: "refused", reason: "failed" };
    await clearWrongGuesses(userId);
    return { status: "started", otpauthUri: result.totpURI, setupKey: key, backupCodes: result.backupCodes };
  } catch (error) {
    if (codeOf(error) === "INVALID_PASSWORD") {
      await recordWrongGuess(userId);
      return { status: "refused", reason: "password" };
    }
    return { status: "refused", reason: codeOf(error) === "TOTP_ALREADY_ENABLED" ? "already-on" : "failed" };
  }
}

/** The new session's token: the session cookie's value up to its first dot (the rest is the signature), URL-decoded. */
async function newSessionToken(responseHeaders: Headers): Promise<string | null> {
  const { name } = (await auth.$context).authCookies.sessionToken;
  const cookie = parseSetCookieHeader(responseHeaders.get("set-cookie") ?? "").get(name);
  return cookie ? decodeURIComponent(cookie.value).split(".")[0] : null;
}

/**
 * Step 3: checks the first code. On success two-factor is on, the session is swapped (the reply's own
 * `token` is the old one) and `responseHeaders` carries the cookie the action must apply. Every other
 * session of the account is deleted (a session says only that someone knew the password), and the new
 * one is cut back to a day if the sign-in was without "Keep me signed in" (the swap resets it to 7 days).
 */
export async function confirmTwoFactor(requestHeaders: Headers, userId: string, code: string): Promise<ConfirmReply> {
  let responseHeaders: Headers;
  try {
    responseHeaders = (await auth.api.verifyTOTP({ body: { code }, headers: requestHeaders, returnHeaders: true })).headers;
  } catch (error) {
    return { status: "refused", reason: codeOf(error) === "INVALID_CODE" ? "code" : "failed" };
  }
  const token = await newSessionToken(responseHeaders);
  // No new cookie: two-factor was already on, so nothing was swapped.
  if (!token) return { status: "refused", reason: "already-on" };
  // The code is checked and two-factor is on: nothing below may fail the setup, or the person would be
  // told it failed and, without the cookie, signed out as well.
  try {
    await db.delete(session).where(and(eq(session.userId, userId), ne(session.token, token)));
    await keepShortSessionShort(token, requestHeaders);
  } catch (error) {
    console.error("two-factor setup: follow-up steps failed", error);
  }
  return { status: "on", responseHeaders };
}

/** Replaces the backup codes (the old ones stop working) after checking the password; a wrong one is counted. */
export async function newBackupCodes(requestHeaders: Headers, userId: string, password: string): Promise<CodesReply> {
  if (await tooManyGuesses(userId)) return { status: "refused", reason: "locked" };
  try {
    const { backupCodes } = await auth.api.generateBackupCodes({ body: { password }, headers: requestHeaders });
    await clearWrongGuesses(userId);
    return { status: "codes", backupCodes };
  } catch (error) {
    if (codeOf(error) === "INVALID_PASSWORD") {
      await recordWrongGuess(userId);
      return { status: "refused", reason: "password" };
    }
    return { status: "refused", reason: codeOf(error) === "TWO_FACTOR_NOT_ENABLED" ? "not-on" : "failed" };
  }
}
