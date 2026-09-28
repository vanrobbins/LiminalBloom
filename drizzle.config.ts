// Configuration for drizzle-kit, the migration tool.
//
// drizzle-kit runs as a standalone command, outside Next.js, so it does not
// get .env.local loaded for it the way the app does. dotenv does that here.

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  // Both schema files: the tables we write by hand, and the ones Better
  // Auth generates. Listing only one silently omits the other's tables.
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations use the direct connection, not the pooled one.
    url: process.env.DATABASE_URL!,
  },
});
