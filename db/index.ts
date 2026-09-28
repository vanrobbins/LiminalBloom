// The database connection. Import `db` from here anywhere on the server.
//
// This module must never be imported into a client component: the connection
// string is a secret and stays on the server. See proposal section 8.4.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as authSchema from "./auth-schema";
import * as appSchema from "./schema";

// Neon gives two connection strings. The pooled one shares a small set of
// connections between requests, which is what a serverless app needs; the
// direct one is used by migrations. Fall back so a single-URL setup works.
const connectionString =
  process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL_POOLED (or DATABASE_URL) is not set. Copy it from the Neon dashboard into .env.local.",
  );
}

// Both schemas are handed to Drizzle together: the tables we wrote
// (db/schema.ts) and the ones Better Auth generated (db/auth-schema.ts).
export const schema = { ...appSchema, ...authSchema };

export const db = drizzle(neon(connectionString), { schema });
