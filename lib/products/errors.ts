// Postgres errors arrive wrapped by Drizzle; the code and constraint name sit
// somewhere down the cause chain (the same walk as lib/layout/save.ts).
// Only recognize known Postgres error codes to avoid false positives (e.g.,
// other errors that happen to have a `code` property).

// Common Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const POSTGRES_ERROR_CODES = new Set([
  // Class 23 — Integrity Constraint Violation
  "23505", // unique_violation
  "23514", // check_violation
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  // Class 42 — Syntax Error or Access Violation
  "42P01", // undefined_table
  "42703", // undefined_column
  "42P07", // duplicate_table
  // Add more as needed; start with the most common ones.
]);

export type DatabaseError = { code: string | undefined; constraint: string | undefined; message: string };

export function databaseError(error: unknown): DatabaseError | null {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const { code, constraint } = current as Error & { code?: unknown; constraint?: unknown };
    if (typeof code === "string" && POSTGRES_ERROR_CODES.has(code)) {
      // Some driver errors carry the name only in the message.
      const named = current.message.match(/constraint "([^"]+)"/)?.[1];
      return { code, constraint: typeof constraint === "string" ? constraint : named, message: current.message };
    }
    current = current.cause;
  }
  return null;
}
