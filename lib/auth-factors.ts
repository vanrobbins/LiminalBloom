// Pure helpers for lib/auth.ts: which endpoints prove a second factor, and the
// passkey relying party. Kept out of lib/auth.ts so they test without Better Auth.
// Spec 0.7.1 8.2 and 8.4.

/**
 * The endpoints whose new session has passed a second factor. `/passkey/verify-registration`
 * can also create a session but proves only a new key, so it is NOT here (spec 8.4 item 1b).
 */
export const SECOND_FACTOR_PATHS: readonly string[] = Object.freeze([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/passkey/verify-authentication",
]);

/** `session.two_factor_at` for a new session: `now` when the endpoint proves a second factor, else null. */
export function twoFactorAtFor(path: string | undefined, now: Date = new Date()): Date | null {
  return path !== undefined && SECOND_FACTOR_PATHS.includes(path) ? now : null;
}

/**
 * The passkey relying party, derived from BETTER_AUTH_URL: rpID is its hostname and origin is its
 * origin, so passkeys follow whichever host the deployment is on (a passkey is bound to the rpID).
 * With no usable URL both are left out and Better Auth derives them from its own baseURL.
 */
export function passkeyRelyingParty(baseUrl: string | undefined): { rpID?: string; origin?: string } {
  try {
    const url = new URL(baseUrl ?? "");
    return { rpID: url.hostname, origin: url.origin };
  } catch {
    return {};
  }
}
