// Better Auth server configuration.
//
// This file is the source of truth for authentication. The CLI reads it to
// generate the database tables (`npx auth generate`), and the API route at
// app/api/auth/[...all]/route.ts hands every auth request to it.
//
// Server only. Never import this into a client component -- it holds the
// signing secret and a direct database connection. See proposal section 8.4.

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { organization, twoFactor } from "better-auth/plugins";

import * as authSchema from "@/db/auth-schema";
import { db } from "@/db";

import { rememberSwitch, storeForNewSession } from "./active-store";
import { passkeyRelyingParty, twoFactorAtFor } from "./auth-factors";
import { optionalEnv } from "./env";

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

const CLOSED_PATHS = [...CLOSED_ORGANIZATION_PATHS, "/change-password"];

export const auth = betterAuth({
  disabledPaths: CLOSED_PATHS,
  // Read through optionalEnv so a value pasted into a dashboard with a
  // trailing newline cannot produce an "Invalid URL" build failure.
  baseURL: optionalEnv("BETTER_AUTH_URL"),
  secret: optionalEnv("BETTER_AUTH_SECRET"),

  user: {
    additionalFields: {
      // The store this person used most recently, so signing in opens it
      // again. Set only by the session hook below, never by a request:
      // `input: false` stops a sign-up body from writing it. Not a foreign
      // key -- a stale value is caught by the membership check in
      // lib/active-store.ts. See docs/DECISIONS.md, 2026-09-29.
      lastActiveStoreId: { type: "string", required: false, input: false },
    },
  },

  session: {
    additionalFields: {
      // When this session last passed a second factor (an authenticator code, a backup code or a
      // passkey), set only by the hook below from the endpoint that made the session; `input: false`
      // so no request can write it. Null otherwise. Spec 0.7.1, 8.2.
      twoFactorAt: { type: "date", required: false, input: false },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Better Auth starts every session with no active store. Pick one,
        // or /products and /welcome send a returning member back and
        // forth forever. This is the pattern the organization plugin docs give.
        // `context.path` is the endpoint that made the session (proved in A0).
        before: async (session, context) => ({
          data: {
            ...session,
            activeOrganizationId: await storeForNewSession(session.userId),
            twoFactorAt: twoFactorAtFor(context?.path),
          },
        }),
      },
      update: {
        // Runs on every session update, including routine refreshes. Only
        // record a store when there is one: a session without an active
        // store must never erase the one remembered.
        after: async (session) => {
          // The plugin adds this field at runtime; its type here is `{}`.
          const storeId = session.activeOrganizationId;
          if (typeof storeId === "string" && storeId) {
            await rememberSwitch(session.userId, storeId);
          }
        },
      },
    },
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    // Hand the adapter the generated tables explicitly, so it maps to the
    // same definitions Drizzle uses rather than guessing by name.
    schema: authSchema,
  }),

  emailAndPassword: {
    enabled: true,
    // Email verification is required by section 3.1 but needs Resend and its
    // own API key. Turning it on before that exists would lock every new
    // account out, including during development. It goes in with the email work.
    requireEmailVerification: false,
  },

  plugins: [
    // Authenticator-app codes and backup codes. Setup runs through the app's own server actions
    // (A3), so its browser endpoints are closed in A3; only verify-totp and verify-backup-code
    // stay open for sign-in. Email codes need Resend, so they stay unused.
    twoFactor({ issuer: "Liminal Bloom", backupCodeOptions: { amount: 10 } }),
    // A passkey sign-in counts as a second factor only because the server demands user
    // verification (`userVerification: "required"`; the default "preferred" is one factor).
    passkey({
      rpName: "Liminal Bloom",
      ...passkeyRelyingParty(optionalEnv("BETTER_AUTH_URL")),
      authenticatorSelection: { userVerification: "required" },
    }),
    // Each retail store is an organization: its own workspace, its own
    // members, its own data. This plugin owns the organization, member and
    // invitation tables from section 7, which is why products.store_id was
    // deliberately left out until now. See docs/DECISIONS.md.
    organization({
      disableOrganizationDeletion: true,
      schema: {
        // The app's own role (a role_definitions id). Better Auth's `role` is
        // left to Better Auth (DECISIONS 09-28). `input: false` so no request
        // can set it; only the app's own actions write it, with Drizzle.
        member: { additionalFields: { roleId: { type: "string", required: false, input: false } } },
        invitation: { additionalFields: { roleId: { type: "string", required: false, input: false } } },
      },
      organizationHooks: {
        // Every store gets its own encryption key, settings row and roles the
        // moment it exists, however it was created: the Server Action, or any
        // server code calling auth.api.createOrganization (Better Auth's own
        // browser endpoint is closed above). Proposal 8.1.
        //
        // Imported inside the hook: store-keys imports `server-only`, and the
        // Better Auth CLI loads this file outside Next.js, where that throws.
        // If the key cannot be made, the store is removed and the request
        // fails, so no store ever exists without one.
        afterCreateOrganization: async ({ organization }) => {
          const { giveStoreItsKey } = await import("./store-keys");
          await giveStoreItsKey(organization.id);
          // A store never exists without a time zone (DECISIONS "Time", 10-12).
          const { giveStoreSettings } = await import("./store-settings");
          try {
            await giveStoreSettings(organization.id);
          } catch (error) {
            const { removeStore } = await import("./store-keys");
            await removeStore(organization.id);
            throw error;
          }
          // The five built-in roles, and the creator as Store Manager (0.7.0).
          // Same rule: a store never exists without them.
          const { giveStoreItsRoles } = await import("./access/seed");
          try {
            await giveStoreItsRoles(organization.id);
          } catch (error) {
            const { removeStore } = await import("./store-keys");
            await removeStore(organization.id);
            throw error;
          }
        },
      },
    }),
  ],
});
