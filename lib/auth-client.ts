// The browser side of Better Auth. Safe to import into client components:
// it only ever talks to /api/auth, and holds no secrets.

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
