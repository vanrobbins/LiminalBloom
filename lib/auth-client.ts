// The browser side of Better Auth. Safe to import into client components:
// it only ever talks to /api/auth, and holds no secrets.

import { organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { optionalEnv } from "./env";

// In the browser the app's own origin is always correct, and needs no
// configuration. Only during prerendering, where there is no window, does the
// environment variable matter -- and it is cleaned before use, because a
// trailing newline on it once failed a production build.
const baseURL =
  typeof window === "undefined"
    ? optionalEnv("BETTER_AUTH_URL")
    : window.location.origin;

export const authClient = createAuthClient({
  baseURL,
  // twoFactorClient makes signIn.email answer { twoFactorRedirect: true } for an account with two-factor on,
  // and gives the sign-in code page twoFactor.verifyTotp / verifyBackupCode.
  plugins: [organizationClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
