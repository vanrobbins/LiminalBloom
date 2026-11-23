// Renaming, removing and starting to add a passkey from Account (spec 0.7.1 8.4, A3c). Better Auth's
// own routes for rename, remove and list are closed (lib/auth-closed-paths.ts): removing needs the
// password and the last-passkey rule, and the name needs a length. Add and the sign-in ceremonies stay
// open, with the password gate in front of adding (lib/passkeys/add-gate.ts).
//
// The password is checked with `auth.api.verifyPassword` and each try is counted under the password
// change's counter (lib/password-guesses.ts), since `auth.api` skips Better Auth's HTTP limiter.

import "server-only";

import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { passkey } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
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

/**
 * Removes one of the account's own passkeys after the password. The last one stays while the account
 * needs a second factor (a Liminal Bloom admin, or a role that requires it) and has no authenticator app:
 * removing it would lock the person out of what they need. (Two removals at once could pass this check
 * together; each needs the password, so it is the person's own doing and is left.)
 */
export async function removePasskey(requestHeaders: Headers, userId: string, id: string, password: string): Promise<ChangeReply> {
  const mine = await listPasskeys(userId);
  if (!mine.some((row) => row.id === id)) return no("missing");
  if (mine.length === 1 && !(await hasAuthenticatorApp(userId))) {
    const need = await twoFactorRequirement(userId);
    if (need.isAdmin || need.store) return no("last", need.store ?? undefined);
  }
  const refusal = await checkPassword(requestHeaders, userId, password);
  if (refusal) return no(refusal);
  const done = await db.delete(passkey).where(and(eq(passkey.id, id), eq(passkey.userId, userId))).returning({ id: passkey.id });
  return done.length === 1 ? { status: "ok" } : no("missing");
}

/** Checks the password and lets the person register one passkey in the next five minutes. */
export async function allowPasskeyAdd(requestHeaders: Headers, userId: string, password: string): Promise<ChangeReply> {
  const refusal = await checkPassword(requestHeaders, userId, password);
  if (refusal) return no(refusal);
  await grantPasskeyAdd(userId);
  return { status: "ok" };
}
