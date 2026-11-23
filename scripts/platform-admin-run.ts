// What `npm run admin:grant` does (spec 0.7.1 7.1). Imported by scripts/platform-admin.ts after it has
// chosen the database, because @/db connects when it is imported. Each job is one batch, so an admin row
// never exists without its platform_events row. The script has no signed-in person, so the event's
// actor is the script itself.

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { platformAdmins, platformEvents } from "@/db/schema";
import { wipeTwoFactor } from "@/lib/two-factor/wipe";

const ACTOR = "Liminal Bloom script";

async function findUser(email: string): Promise<{ id: string; email: string }> {
  const [found] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.email, email.trim().toLowerCase()));
  if (!found) throw new Error(`No account for ${email.trim().toLowerCase()}. They must sign up first.`);
  return found;
}

const event = (action: string, who: { id: string; email: string }, reason: string) => ({
  actorName: ACTOR,
  action,
  targetKind: "admin",
  targetId: who.id,
  targetLabel: who.email,
  reason,
});

/** Makes the account with this email a Liminal Bloom admin (they set up two-step sign-in on their first visit to /admin). */
export async function grantAdmin(email: string): Promise<{ status: "granted" | "already"; userId: string }> {
  const who = await findUser(email);
  const [existing] = await db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, who.id));
  if (existing) return { status: "already", userId: who.id };
  await db.batch([
    db.insert(platformAdmins).values({ userId: who.id, addedByName: ACTOR }).onConflictDoNothing(),
    db.insert(platformEvents).values(event("admin_added", who, "Granted by npm run admin:grant")),
  ]);
  return { status: "granted", userId: who.id };
}

/**
 * For an admin who lost both their authenticator app and their backup codes: two-factor goes off, the
 * secret, passkeys, trusted devices and wrong-code count are forgotten, and every session ends. They sign in with
 * the password and set it up again. There is no in-app reset on purpose: one compromised admin must not
 * be able to weaken another (spec 7.1).
 */
export async function resetTwoFactor(email: string): Promise<{ status: "reset"; userId: string }> {
  const who = await findUser(email);
  const [admin] = await db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, who.id));
  if (!admin) throw new Error(`${who.email} is not a Liminal Bloom admin. Grant it first (npm run admin:grant).`);
  await db.batch([
    // Passkeys, trusted devices and the step-up count go too: the admin who lost the device may be the one who lost the passkey, and registers a new one after signing in.
    ...wipeTwoFactor(who.id),
    db.insert(platformEvents).values(event("two_factor_reset", who, "Reset by npm run admin:grant -- --reset-two-factor")),
  ]);
  return { status: "reset", userId: who.id };
}
