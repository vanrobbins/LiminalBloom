// Turning two-factor off for an account: the password and a current authenticator code, the way turning
// it on asked for the password and a first code (spec 0.7.1 8.3, A3b). Better Auth's browser route is
// closed (lib/auth-closed-paths.ts), so this is the only way, and `auth.api.disableTwoFactor` is called
// with the caller's session. A0 (8.4) and the source: it deletes the factor, starts a NEW session in place
// of this one and sets cookies (it also forgets this device's trusted-device mark), so the cookies are
// carried back and the new session is cut to a day if the sign-in was without "Keep me signed in".
//
// With a session present Better Auth counts no wrong codes and `auth.api` skips its HTTP limiter, so both
// tries are counted here: the code under the step-up's counter, the password under the password counter.
// A Liminal Bloom admin can't turn it off (spec 8.2), nor can anyone whose role requires it (A3b).

import "server-only";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { auth } from "@/lib/auth";
import { keepShortSessionShort } from "@/lib/change-password";
import { claimCodeGuess, clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { claimGuess, clearWrongGuesses } from "@/lib/password-guesses";

import { storeRequiringTwoFactor } from "./required-by";
import { bestEffort } from "./best-effort";
import { newSessionToken } from "./setup";
import { forgetTrustedDevices } from "./trusted-devices";

export type DisableReply = { status: "off"; responseHeaders: Headers } | { status: "refused"; reason: "password" | "code" | "locked" | "not-on" | "admin" | "required" | "failed"; store?: string };

const codeOf = (error: unknown) => (error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined);

export async function disableTwoFactor(requestHeaders: Headers, userId: string, password: string, code: string): Promise<DisableReply> {
  const [admin] = await db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId));
  if (admin) return { status: "refused", reason: "admin" };
  // A role that requires it keeps it on (turning it off would only lock the person out of the store), and no try is spent.
  const store = await storeRequiringTwoFactor(userId);
  if (store) return { status: "refused", reason: "required", store };

  // The code first, so a wrong one never spends a password try.
  if (!(await claimCodeGuess(userId))) return { status: "refused", reason: "locked" };
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: requestHeaders });
  } catch (error) {
    const found = codeOf(error);
    if (found === "INVALID_CODE") return { status: "refused", reason: "code" };
    return { status: "refused", reason: found === "TOTP_NOT_ENABLED" ? "not-on" : "failed" };
  }
  // A right code is not a wrong try: clear the counter here, so a mistyped password after it never burns code tries.
  await clearWrongCodes(userId).catch((error: unknown) => console.error("two-factor turn off: code counter not cleared", error));
  if (!(await claimGuess(userId))) return { status: "refused", reason: "locked" };
  let responseHeaders: Headers;
  try {
    responseHeaders = (await auth.api.disableTwoFactor({ body: { password }, headers: requestHeaders, returnHeaders: true })).headers;
  } catch (error) {
    return { status: "refused", reason: codeOf(error) === "INVALID_PASSWORD" ? "password" : "failed" };
  }
  // It is off: nothing below may fail the change (the person would be told it failed and, without the cookie, signed out), and each step stands alone.
  // Better Auth forgets only this device's trust; every other trusted device is forgotten here.
  await bestEffort("forget trusted devices", () => forgetTrustedDevices(userId));
  await bestEffort("clear wrong guesses", () => clearWrongGuesses(userId));
  await bestEffort("shorten the session", async () => {
    const token = await newSessionToken(responseHeaders);
    if (token) await keepShortSessionShort(token, requestHeaders);
  });
  return { status: "off", responseHeaders };
}
