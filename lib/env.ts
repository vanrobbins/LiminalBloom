// Reading environment variables safely.
//
// Values arrive by being pasted into dashboards -- Vercel, Neon -- and pastes
// pick up whitespace. A single trailing newline on BETTER_AUTH_URL failed a
// production build with `Invalid URL`, an error that named the code using the
// value rather than the value itself.
//
// Cleaning here means one place fixes it for every caller, and a missing
// variable fails with a message that says which one.

/** Trim whitespace, and strip quotes if they wrap the whole value. */
function clean(value: string): string {
  const trimmed = value.trim();

  const isWrappedInQuotes =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")));

  return isWrappedInQuotes ? trimmed.slice(1, -1).trim() : trimmed;
}

/**
 * Read a variable that the app cannot run without.
 *
 * Throws naming the variable, because "Invalid URL" three layers down is a
 * much worse way to learn that a dashboard field is empty.
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || clean(value) === "") {
    throw new Error(
      `${name} is not set. Check .env.local locally, or the project's environment variables in Vercel. See .env.example.`,
    );
  }

  return clean(value);
}

/** Read a variable that may legitimately be absent. */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];

  if (value === undefined || clean(value) === "") {
    return undefined;
  }

  return clean(value);
}
