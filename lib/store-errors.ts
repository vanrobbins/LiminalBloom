// Recognising which store-creation failures are worth retrying.
//
// Only one is: the slug is already taken, so a suffixed slug may succeed.
// Anything else -- a key that could not be made, a database error -- would
// fail the same way again, and retrying it only creates more half-made stores.

/** True when Better Auth refused a new store because its slug is in use. */
export function isSlugTaken(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("body" in error)) {
    return false;
  }

  const { body } = error;

  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    body.code === "ORGANIZATION_ALREADY_EXISTS"
  );
}
