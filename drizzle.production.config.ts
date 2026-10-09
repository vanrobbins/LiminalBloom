// drizzle-kit configuration pointed at the PRODUCTION database.
//
// Deliberately a separate file with a separate npm script (`db:migrate:prod`),
// so running a migration against production is always an explicit choice and
// never something that happens because of an environment variable you forgot
// was set.
//
// PRODUCTION_DATABASE_URL lives in .env.local, which is gitignored. Holding
// production credentials on a development machine is a real risk: it means a
// mistyped command can reach production. The separate name is the guard.

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const url = process.env.PRODUCTION_DATABASE_URL;

if (!url) {
  throw new Error(
    "PRODUCTION_DATABASE_URL is not set in .env.local. It is the direct (unpooled) connection string of the Neon production branch.",
  );
}

export default defineConfig({
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
