// "Reset two-factor" for an ordinary account (spec 0.7.1 7.4, deferred from A3b): an admin helps someone who
// lost their authenticator app and backup codes. The reason is required and logged; the account signs in with
// its password and sets two-factor up again. NEVER for a Liminal Bloom admin: an admin's reset is the script's
// alone (`npm run admin:grant -- --reset-two-factor`, spec 7.1), so one compromised admin cannot weaken another.
//
// One batch (lib/two-factor/wipe.ts + the event), every statement guarded by "not an admin", so an admin row
// that appears after the check still stops all of it.

import "server-only";

import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { passkey, user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { wipeTwoFactor } from "@/lib/two-factor/wipe";

import { type AdminActor, platformEventFrom } from "./events";

export type ResetOutcome = { status: "done" } | { status: "gone" | "admin" | "not-on" };

const notAdmin = (userId: string) => sql`not exists (select 1 from platform_admins a where a.user_id = ${userId}::text)`;

/** The writes alone, for an account already read. Exported so a test can run them against an admin row that appeared after the check. */
export async function applyReset(actor: AdminActor, who: { id: string; email: string }, reason: string): Promise<ResetOutcome> {
  const guard = notAdmin(who.id);
  const source = sql`"user" u where u.id = ${who.id}::text and ${guard}`;
  const event = sql`${platformEventFrom(actor, { action: "two_factor_reset", targetKind: "user", targetId: who.id, targetLabel: who.email, reason }, source)} returning id`;
  const results = await db.batch([...wipeTwoFactor(who.id, guard), db.execute(event)]);
  const logged = results[results.length - 1] as { rows: unknown[] };
  return logged.rows.length === 1 ? { status: "done" } : { status: "admin" };
}

export async function resetAccountTwoFactor(actor: AdminActor, userId: string, reason: string): Promise<ResetOutcome> {
  const [who] = await db.select({ id: user.id, email: user.email, on: user.twoFactorEnabled, admin: platformAdmins.userId }).from(user).leftJoin(platformAdmins, eq(platformAdmins.userId, user.id)).where(eq(user.id, userId));
  if (!who) return { status: "gone" };
  if (who.admin !== null) return { status: "admin" };
  const [keys] = await db.select({ n: count() }).from(passkey).where(eq(passkey.userId, userId));
  if (who.on !== true && keys.n === 0) return { status: "not-on" };
  return applyReset(actor, { id: who.id, email: who.email }, reason);
}
