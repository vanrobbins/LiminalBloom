// The 12-hour rule and the table of spec 0.7.1 7.2, as pure functions so they test without a
// database: how recently a person passed a second factor, and where an account stands in front of /admin.

/** An admin's last second factor counts for 12 hours. */
export const ADMIN_FRESH_MS = 12 * 3_600_000;
// A clock a little ahead of ours is not a reason to refuse; one far ahead is not a real time.
const SKEW_MS = 60_000;

/** Whether `twoFactorAt` (a session's `two_factor_at`) is within 12 hours of `now`. Missing is never fresh. */
export function isFresh(twoFactorAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!(twoFactorAt instanceof Date)) return false;
  const age = now.getTime() - twoFactorAt.getTime();
  return age <= ADMIN_FRESH_MS && age >= -SKEW_MS;
}

export type AdminFacts = { signedIn: boolean; isAdmin: boolean; twoFactorEnabled: boolean; twoFactorAt: Date | null };
export type AdminStanding = "signed-out" | "not-admin" | "needs-two-factor" | "needs-verify" | "ok";

/** Where an account stands, checked in the order of the table: a non-admin learns nothing about factors. */
export function adminStanding(facts: AdminFacts, now: Date = new Date()): AdminStanding {
  if (!facts.signedIn) return "signed-out";
  if (!facts.isAdmin) return "not-admin";
  if (!facts.twoFactorEnabled) return "needs-two-factor";
  return isFresh(facts.twoFactorAt, now) ? "ok" : "needs-verify";
}
