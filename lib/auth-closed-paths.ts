// The Better Auth endpoints the browser cannot reach (`disabledPaths` in lib/auth.ts). Apart from
// lib/auth.ts so that file stays short and this list is read and tested without Better Auth.
// `auth.api.*` calls from server code are not affected by any of it.

// Better Auth's organization endpoints that read or change people. Its own checks
// know only owner / admin / member, not our roles or the rank rule, and three of them
// list emails and invitation ids to any member. So the browser cannot reach them: the
// router answers 404 before anything runs. People, roles and invitations go through the
// app's own server actions (lib/access/people-write.ts, invite.ts, invitation-accept.ts
// and roles-*.ts). `auth.api.*` calls from server
// code are not affected. Not here: `/organization/set-active` (the store switcher).
// `/change-password` is closed too, below: the browser's own call would not revoke the
// person's other sessions, so the Account page's server action calls
// `auth.api.changePassword` with `revokeOtherSessions: true` instead (lib/change-password.db.test.ts
// proves the server call still works). Spec 0.7, 4.5, "Spike findings";
// e2e/auth-routes.spec.ts proves each path and its spellings.
const CLOSED_ORGANIZATION_PATHS = [
  "invite-member",
  "cancel-invitation",
  "accept-invitation",
  "reject-invitation",
  "update-member-role",
  "remove-member",
  "leave",
  "update",
  "delete",
  "create",
  "list-invitations",
  "get-full-organization",
  "list-members",
  "get-invitation",
  "list-user-invitations",
].map((name) => `/organization/${name}`);

// Two-factor setup runs through the app's own server actions (lib/two-factor/, spec 0.7.1 8.2 and 8.3),
// so the browser cannot turn it on or off, read its link, or ask for new backup codes: each of those
// answers 404. Email codes need Resend, so their two endpoints are closed too. Open on purpose:
// /two-factor/verify-totp and /two-factor/verify-backup-code, which sign-in needs (but only without
// a session: lib/auth-sign-in-only.ts answers 404 to a request that has one). The passkey
// routes stay open too (they need a session; A3c). e2e/auth-routes.spec.ts proves each path and its spellings.
const CLOSED_TWO_FACTOR_PATHS = ["enable", "disable", "get-totp-uri", "generate-backup-codes", "send-otp", "verify-otp"].map((name) => `/two-factor/${name}`);

export const CLOSED_PATHS: string[] = [...CLOSED_ORGANIZATION_PATHS, ...CLOSED_TWO_FACTOR_PATHS, "/change-password"];

// True when a request pathname under /api/auth is a closed path in any spelling: percent-encoding,
// letter case, and repeated or trailing slashes are folded away first. The route handler uses it to
// answer 404 before Better Auth's rate limiter runs.
export function isClosedAuthPath(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A malformed escape is not a closed path's spelling; Better Auth answers it.
  }
  const rest = decoded.toLowerCase().replace(/^\/api\/auth(?=\/|$)/, "").replace(/\/+/g, "/").replace(/\/$/, "");
  return CLOSED_PATHS.includes(rest);
}
