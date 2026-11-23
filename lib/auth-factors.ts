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

const PRODUCTION_RP_ID = "liminalbloom.app";

/**
 * The passkey relying party: `localhost` in development, `liminalbloom.app` everywhere else
 * (a passkey is bound to this id, so it must not follow a preview host). The origin comes from
 * BETTER_AUTH_URL; with none, Better Auth derives it from its own baseURL.
 */
export function passkeyRelyingParty(baseUrl: string | undefined): { rpID: string; origin: string | undefined } {
  let url: URL | null = null;
  try {
    url = baseUrl ? new URL(baseUrl) : null;
  } catch {
    url = null;
  }
  return { rpID: url?.hostname === "localhost" ? "localhost" : PRODUCTION_RP_ID, origin: url?.origin };
}
