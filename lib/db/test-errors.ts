// Tests that expect the database to refuse something must say which refusal,
// so an unrelated failure (a typo, a dropped connection) can't pass them (B2).

/** Postgres's own words: drizzle wraps a failed query ("Failed query: …") with the reason in `cause`. */
export async function dbRefusal(work: PromiseLike<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    const failure = error as Error & { cause?: unknown };
    return failure.cause instanceof Error ? failure.cause.message : failure.message;
  }
  throw new Error("Expected the database to refuse this, but it was accepted.");
}
