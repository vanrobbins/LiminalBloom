// Turning two-factor on, shared by everyone who can (admins now; any account in A3b): start with the
// password, confirm with a code, ask for new backup codes. Each takes the request's headers (the caller's
// session cookie) and the person's id and answers with an outcome; the server actions around them
// (app/admin/two-factor/actions.ts) guard first and carry the cookies to the browser. Spec 0.7.1 8.3,
// proved in A0 (8.4 items 2): `enableTwoFactor` sets no cookie and swaps nothing; the first correct
// `verifyTOTP` turns it on, swaps the session (the hook sets `two_factor_at`) and sets one cookie.
//
// Better Auth's browser routes for all of this are closed (lib/auth-closed-paths.ts); these call
// `auth.api`, which skips its HTTP rate limiter, so the tries are counted here: passwords as the password
// change does (lib/password-guesses.ts), the confirm's codes under the step-up's counter (lib/admin/two-factor-guesses.ts).

import "server-only";

import { APIError } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { session, user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { keepShortSessionShort } from "@/lib/change-password";
import { claimCodeGuess, clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { claimGuess, clearWrongGuesses } from "@/lib/password-guesses";

import { bestEffort } from "./best-effort";
import { hasPasskey } from "@/lib/passkeys/list";

import { needsFreshProof, sessionTwoFactorAt } from "./fresh-proof";
import { qrSvgOf } from "./qr";
import { setupKey } from "./totp-key";
import { forgetTrustedDevices } from "./trusted-devices";

const ISSUER = "Liminal Bloom";

export type StartReply =
  | { status: "started"; otpauthUri: string; setupKey: string; qrSvg: string | null; backupCodes: string[] }
  | { status: "refused"; reason: "password" | "locked" | "already-on" | "verify" | "failed" };
export type ConfirmReply = { status: "on"; responseHeaders: Headers } | { status: "refused"; reason: "code" | "locked" | "already-on" | "verify" | "failed" };
export type CodesReply = { status: "codes"; backupCodes: string[] } | { status: "refused"; reason: "password" | "locked" | "not-on" | "verify" | "failed" };

const codeOf = (error: unknown) => (error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined);

/** Step 1: checks the password (each try is counted, 5 per 10 minutes) and stores a new unverified secret with ten backup codes. Calling it again before confirming starts over. */
export async function startTwoFactor(requestHeaders: Headers, userId: string, password: string): Promise<StartReply> {
  // An admin who already has a second factor (a passkey) must prove one lately before adding another (lib/two-factor/fresh-proof.ts).
  if (await needsFreshProof(requestHeaders, userId)) return { status: "refused", reason: "verify" };
  if (!(await claimGuess(userId))) return { status: "refused", reason: "locked" };
  try {
    const result = await auth.api.enableTwoFactor({ body: { password, issuer: ISSUER }, headers: requestHeaders });
    const key = "totpURI" in result ? setupKey(result.totpURI) : null;
    if (!("totpURI" in result) || !key) return { status: "refused", reason: "failed" };
    await clearWrongGuesses(userId);
    return { status: "started", otpauthUri: result.totpURI, setupKey: key, qrSvg: await qrSvgOf(result.totpURI), backupCodes: result.backupCodes };
  } catch (error) {
    if (codeOf(error) === "INVALID_PASSWORD") return { status: "refused", reason: "password" };
    return { status: "refused", reason: codeOf(error) === "TOTP_ALREADY_ENABLED" ? "already-on" : "failed" };
  }
}

/** The new session's token: the session cookie's value up to its first dot (the rest is the signature), URL-decoded. */
export async function newSessionToken(responseHeaders: Headers): Promise<string | null> {
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
  // With a session present Better Auth counts no wrong codes (A0, 8.4 item 2) and this call skips its HTTP
  // limiter, so a stolen session could guess without end. Already on: refuse before the code is even looked at
  // (an account that is on would make this a code oracle for the step-up). Otherwise the try is counted first,
  // per account in one statement, under the step-up's `two-factor-failures:` counter (5 per 10 minutes).
  const [row] = await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId));
  if (row?.on) return { status: "refused", reason: "already-on" };
  if (await needsFreshProof(requestHeaders, userId)) return { status: "refused", reason: "verify" };
  if (!(await claimCodeGuess(userId))) return { status: "refused", reason: "locked" };
  // An account that already has a factor (a passkey) keeps its session's proof as it was: the confirm's new session
  // is stamped "just passed a second factor" by Better Auth's hook, which a stolen session must not get by adding an app.
  const had = (await hasPasskey(userId)) ? { at: await sessionTwoFactorAt(requestHeaders, userId) } : null;
  let responseHeaders: Headers;
  try {
    responseHeaders = (await auth.api.verifyTOTP({ body: { code }, headers: requestHeaders, returnHeaders: true })).headers;
  } catch (error) {
    return { status: "refused", reason: codeOf(error) === "INVALID_CODE" ? "code" : "failed" };
  }
  const token = await newSessionToken(responseHeaders);
  // No new cookie: two-factor was already on, so nothing was swapped.
  if (!token) return { status: "refused", reason: "already-on" };
  if (had) await db.update(session).set({ twoFactorAt: had.at }).where(eq(session.token, token));
  // The code is checked and two-factor is on: nothing below may fail the setup, and each step stands alone.
  await bestEffort("clear wrong codes", () => clearWrongCodes(userId));
  // Trust marks left from an earlier time it was on mean nothing for this new secret.
  await bestEffort("forget trusted devices", () => forgetTrustedDevices(userId));
  await bestEffort("sign out other sessions", () => db.delete(session).where(and(eq(session.userId, userId), ne(session.token, token))));
  await bestEffort("shorten the session", () => keepShortSessionShort(token, requestHeaders));
  return { status: "on", responseHeaders };
}

/** Replaces the backup codes (the old ones stop working) after checking the password; a wrong one is counted. */
export async function newBackupCodes(requestHeaders: Headers, userId: string, password: string): Promise<CodesReply> {
  if (await needsFreshProof(requestHeaders, userId)) return { status: "refused", reason: "verify" };
  if (!(await claimGuess(userId))) return { status: "refused", reason: "locked" };
  try {
    const { backupCodes } = await auth.api.generateBackupCodes({ body: { password }, headers: requestHeaders });
    await clearWrongGuesses(userId);
    return { status: "codes", backupCodes };
  } catch (error) {
    if (codeOf(error) === "INVALID_PASSWORD") return { status: "refused", reason: "password" };
    return { status: "refused", reason: codeOf(error) === "TWO_FACTOR_NOT_ENABLED" ? "not-on" : "failed" };
  }
}
