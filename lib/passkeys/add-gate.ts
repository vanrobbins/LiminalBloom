// Adding a passkey needs the password just before, so a stolen session cookie cannot add a key of its
// own: a passkey counts as a second factor, and that is what the admin step-up and a role's "Requires
// two-factor" ask for. Better Auth's own check is only "a session made in the last day".
//
// The Account page's action `allowPasskeyAdd` (lib/passkeys/change.ts) checks the password and writes a
// short-lived grant, a row in Better Auth's `verification` table. This hook (in `hooks.before`,
// lib/auth-before.ts) answers 403 to a browser request for the two registration routes unless the
// signed-in person has the grant, and spends it when the registration is verified. Calls from server
// code (no `request`) and requests with no session (Better Auth answers those itself) pass.
// No `server-only` here: the Better Auth CLI loads lib/auth.ts outside Next.js.

import { APIError, getAuthoritativeSessionFromCtx } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/auth-schema";

export const PASSKEY_ADD_PATHS: readonly string[] = ["/passkey/generate-register-options", "/passkey/verify-registration"];
const SPENT_ON = "/passkey/verify-registration";
export const GRANT_MS = 5 * 60_000;

const keyOf = (userId: string) => `passkey-add:${userId}`;

/** Lets this person register one passkey in the next five minutes. */
export async function grantPasskeyAdd(userId: string, now: Date = new Date()): Promise<void> {
  const key = keyOf(userId);
  const expiresAt = new Date(now.getTime() + GRANT_MS);
  await db.insert(verification).values({ id: key, identifier: key, value: "1", expiresAt }).onConflictDoUpdate({ target: verification.id, set: { expiresAt } });
}

export async function hasPasskeyAddGrant(userId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db.select({ id: verification.id }).from(verification).where(and(eq(verification.id, keyOf(userId)), gt(verification.expiresAt, now)));
  return row !== undefined;
}

export async function spendPasskeyAddGrant(userId: string): Promise<void> {
  await db.delete(verification).where(eq(verification.id, keyOf(userId)));
}

type HookContext = { path?: string; request?: Request } & Parameters<typeof getAuthoritativeSessionFromCtx>[0];

export async function requirePasskeyAddGrant(ctx: HookContext): Promise<void> {
  if (ctx.request === undefined || !PASSKEY_ADD_PATHS.includes(ctx.path ?? "")) return;
  const current = await getAuthoritativeSessionFromCtx(ctx);
  if (!current) return;
  if (!(await hasPasskeyAddGrant(current.user.id))) throw new APIError("FORBIDDEN", { message: "Enter your password to add a passkey.", code: "PASSKEY_NEEDS_PASSWORD" });
  if (ctx.path === SPENT_ON) await spendPasskeyAddGrant(current.user.id);
}
