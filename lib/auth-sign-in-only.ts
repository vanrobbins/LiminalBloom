// `hooks.before` for the two sign-in verifications (/two-factor/verify-totp and /verify-backup-code).
// They are for the sign-in challenge, which is answered with the two-factor cookie and no session. Given
// a session cookie, Better Auth takes the session branch instead: wrong codes are counted nowhere but
// the per-IP limiter (a code oracle for a stolen session), and a right one with setup under way turns
// two-factor on from the browser, past the app's own confirm (no other-session cleanup, no short-session
// cut: lib/two-factor/setup.ts). So a browser request that carries a valid session gets 404, as a
// closed path does. Server code calling `auth.api.verifyTOTP` (the confirm, the step-up) has no
// `request` and is let through. Spec 0.7.1 8.2; e2e/auth-routes.spec.ts proves it over HTTP.

import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";

export const SIGN_IN_ONLY_PATHS: readonly string[] = ["/two-factor/verify-totp", "/two-factor/verify-backup-code"];

export const refuseSessionOnSignInPaths = createAuthMiddleware(async (ctx) => {
  if (ctx.request === undefined || !SIGN_IN_ONLY_PATHS.includes(ctx.path ?? "")) return;
  if (await getAuthoritativeSessionFromCtx(ctx)) throw new APIError("NOT_FOUND", { message: "Not found" });
});
