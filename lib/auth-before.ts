// The one `hooks.before` for lib/auth.ts, which takes a single middleware: the two sign-in verify routes
// refuse a request that has a session (lib/auth-sign-in-only.ts), and the passkey registration routes
// want the password just before (lib/passkeys/add-gate.ts).

import { createAuthMiddleware } from "better-auth/api";

import { requirePasskeyAddGrant } from "./passkeys/add-gate";
import { refuseSessionOnSignInPath } from "./auth-sign-in-only";

export const beforeAuth = createAuthMiddleware(async (ctx) => {
  await refuseSessionOnSignInPath(ctx);
  await requirePasskeyAddGrant(ctx);
});
