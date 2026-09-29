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

import { optionalEnv } from "./env";

export const auth = betterAuth({
  // Read through optionalEnv so a value pasted into a dashboard with a
  // trailing newline cannot produce an "Invalid URL" build failure.
  baseURL: optionalEnv("BETTER_AUTH_URL"),
  secret: optionalEnv("BETTER_AUTH_SECRET"),

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
    organization(),
  ],
});
