// Renaming, removing and starting to add a passkey from Account (spec 0.7.1 8.4, A3c). Better Auth's
// own routes for rename, remove and list are closed (lib/auth-closed-paths.ts): removing needs the
// password and the last-passkey rule, and the name needs a length. Add and the sign-in ceremonies stay
// open, with the password gate (and a code, with an authenticator app) in front of adding (lib/passkeys/add-gate.ts).
//
// The password is checked with `auth.api.verifyPassword` and each try is counted under the password
// change's counter (lib/password-guesses.ts), since `auth.api` skips Better Auth's HTTP limiter.

import "server-only";

import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { passkey } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { claimCodeGuess, clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { claimGuess, clearWrongGuesses } from "@/lib/password-guesses";
import { hasAuthenticatorApp } from "@/lib/two-factor/has-second-factor";
import { twoFactorRequirement } from "@/lib/two-factor/required-by";

import { grantPasskeyAdd } from "./add-gate";
import { listPasskeys } from "./list";
import type { PasskeyRefusal } from "./replies";

export const MAX_PASSKEY_NAME = 60;

export type ChangeReply = { status: "ok" } | { status: "refused"; reason: PasskeyRefusal; store?: string };
const no = (reason: PasskeyRefusal, store?: string): ChangeReply => ({ status: "refused", reason, ...(store ? { store } : {}) });

/** Renames one of the account's own passkeys. */
export async function renamePasskey(userId: string, id: string, name: string): Promise<ChangeReply> {
  const clean = name.trim();
  if (clean === "" || clean.length > MAX_PASSKEY_NAME) return no("name");
  const done = await db.update(passkey).set({ name: clean }).where(and(eq(passkey.id, id), eq(passkey.userId, userId))).returning({ id: passkey.id });
  return done.length === 1 ? { status: "ok" } : no("missing");
}

async function checkPassword(requestHeaders: Headers, userId: string, password: string): Promise<PasskeyRefusal | null> {
  if (!(await claimGuess(userId))) return "locked";
  try {
    await auth.api.verifyPassword({ body: { password }, headers: requestHeaders });
  } catch (error) {
    return error instanceof APIError && (error.body as { code?: string } | undefined)?.code === "INVALID_PASSWORD" ? "password" : "failed";
  }
  await clearWrongGuesses(userId);
  return null;
}

async function checkCode(requestHeaders: Headers, userId: string, code: string | undefined): Promise<PasskeyRefusal | null> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return "code";
  if (!(await claimCodeGuess(userId))) return "locked";
  try {
    await auth.api.verifyTOTP({ body: { code: code.trim() }, headers: requestHeaders });
  } catch (error) {
    return error instanceof APIError && (error.body as { code?: string } | undefined)?.code === "INVALID_CODE" ? "code" : "failed";
  }
  await clearWrongCodes(userId);
  return null;
}

/**
 * Removes one of the account's own passkeys after the password. The last one stays while the account
 * needs a second factor (a Liminal Bloom admin, or a role that requires it) and has no authenticator app:
 * removing it would lock the person out of what they need. The delete itself re-checks that in one
 * statement: it first locks the account's passkey rows (`for update`, in id order), so two removals at
 * once queue, and the second counts only what is left once the first is done (a deleted row is skipped).
 */
export async function removePasskey(requestHeaders: Headers, userId: string, id: string, password: string): Promise<ChangeReply> {
  const mine = await listPasskeys(userId);
  if (!mine.some((row) => row.id === id)) return no("missing");
  let store: string | undefined;
  let guarded = false;
  if (!(await hasAuthenticatorApp(userId))) {
    const need = await twoFactorRequirement(userId);
    guarded = need.isAdmin || need.store !== null;
    store = need.store ?? undefined;
  }
  if (guarded && mine.length === 1) return no("last", store);
  const refusal = await checkPassword(requestHeaders, userId, password);
  if (refusal) return no(refusal);
  const done = await db.execute(sql`
    with mine as (select ${passkey.id} from ${passkey} where ${passkey.userId} = ${userId} order by ${passkey.id} for update)
    delete from ${passkey} where ${passkey.id} = ${id} and ${passkey.userId} = ${userId} and (${!guarded} or (select count(*) from mine) > 1)
    returning ${passkey.id}
  `);
  if (done.rows.length === 1) return { status: "ok" };
  return guarded && (await listPasskeys(userId)).some((row) => row.id === id) ? no("last", store) : no("missing");
}

/**
 * Checks the password (and, with an authenticator app on, a current code too: a stolen session plus the
 * password must not add a key that then stands in for the app) and lets this session register one passkey
 * in the next five minutes. The code goes first, so a wrong one never spends a password try.
 */
export async function allowPasskeyAdd(requestHeaders: Headers, userId: string, password: string, code?: string): Promise<ChangeReply> {
  const current = await auth.api.getSession({ headers: requestHeaders });
  if (!current || current.user.id !== userId) return no("failed");
  if (await hasAuthenticatorApp(userId)) {
    const wrong = await checkCode(requestHeaders, userId, code);
    if (wrong) return no(wrong);
  }
  const refusal = await checkPassword(requestHeaders, userId, password);
  if (refusal) return no(refusal);
  await grantPasskeyAdd(userId, current.session.id);
  return { status: "ok" };
}
