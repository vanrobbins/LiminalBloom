// Better Auth server configuration.
//
// This file is the source of truth for authentication. The CLI reads it to
// generate the database tables (`npx auth generate`), and the API route at
// app/api/auth/[...all]/route.ts hands every auth request to it.
//
// Server only. Never import this into a client component -- it holds the
// signing secret and a direct database connection. See proposal section 8.4.

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

import * as authSchema from "@/db/auth-schema";
import { db } from "@/db";

import { chooseActiveStore, rememberActiveStore } from "./active-store";
import { optionalEnv } from "./env";

export const auth = betterAuth({
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

  databaseHooks: {
    session: {
      create: {
        // Better Auth starts every session with no active store. Pick one,
        // or /products and /create-store send a returning member back and
        // forth forever. This is the pattern the organization plugin docs give.
        before: async (session) => ({
          data: {
            ...session,
            activeOrganizationId: await chooseActiveStore(session.userId),
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
            await rememberActiveStore(session.userId, storeId);
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
    // Each retail store is an organization: its own workspace, its own
    // members, its own data. This plugin owns the organization, member and
    // invitation tables from section 7, which is why products.store_id was
    // deliberately left out until now. See docs/DECISIONS.md.
    organization({
      organizationHooks: {
        // Every store gets its own encryption key the moment it exists,
        // however it was created -- the Server Action or Better Auth's own
        // endpoint. Proposal 8.1.
        //
        // Imported inside the hook: store-keys imports `server-only`, and the
        // Better Auth CLI loads this file outside Next.js, where that throws.
        // If the key cannot be made, the store is removed and the request
        // fails, so no store ever exists without one.
        afterCreateOrganization: async ({ organization }) => {
          const { giveStoreItsKey } = await import("./store-keys");
          await giveStoreItsKey(organization.id);
        },
      },
    }),
  ],
});
