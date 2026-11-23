// A limit on wrong guesses of a secret (a current password, an authenticator code) when the check
// runs through `auth.api.*` from a server action: those calls skip Better Auth's HTTP rate limiter.
// After MAX_WRONG_GUESSES tries inside the window the action refuses without asking Better Auth.
//
// The count is shared by every serverless instance, so it is a row in Better Auth's own
// `verification` table: identifier `<prefix>:<userId>`, value = the count, expiresAt = the window's
// end. The row's id is the same string, so one statement (insert, or on conflict add one) is atomic:
// the HTTP driver has no transactions. lib/password-guesses.ts and lib/admin/two-factor-guesses.ts
// each make one with their own prefix.

import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/auth-schema";

export const MAX_WRONG_GUESSES = 5;
export const WRONG_GUESS_WINDOW_MS = 10 * 60_000;

export function guessLimit(prefix: string) {
  const keyOf = (userId: string) => `${prefix}:${userId}`;
  /** The one atomic statement: insert the count 1, or add one (or restart at 1 once the window has ended). Returns the count now. */
  async function bump(userId: string, now: Date): Promise<number> {
    const key = keyOf(userId);
    const end = new Date(now.getTime() + WRONG_GUESS_WINDOW_MS);
    // ISO strings cast to timestamp: the column holds UTC without a zone, as Drizzle writes it.
    const over = sql`${verification.expiresAt} <= ${now.toISOString()}::timestamp`;
    const [row] = await db
      .insert(verification)
      .values({ id: key, identifier: key, value: "1", expiresAt: end })
      .onConflictDoUpdate({
        target: verification.id,
        set: {
          value: sql`case when ${over} then '1' else (${verification.value}::int + 1)::text end`,
          expiresAt: sql`case when ${over} then ${end.toISOString()}::timestamp else ${verification.expiresAt} end`,
        },
      })
      .returning({ value: verification.value });
    return Number(row.value);
  }

  return {
    /** True once this person has used up their wrong guesses and the window has not ended. */
    async tooMany(userId: string, now = new Date()): Promise<boolean> {
      const [row] = await db
        .select({ value: verification.value })
        .from(verification)
        .where(and(eq(verification.id, keyOf(userId)), gt(verification.expiresAt, now)));
      return row !== undefined && Number(row.value) >= MAX_WRONG_GUESSES;
    },

    /**
     * Counts one try BEFORE the secret is checked and says whether it may go ahead (true) or the limit is
     * already spent (false). One statement does the count, so parallel requests each get their own number
     * and at most MAX_WRONG_GUESSES of them pass; a check-then-record pair would let them all through.
     * The caller clears on a right answer. A try refused for being over the limit does not move the window.
     */
    async claim(userId: string, now = new Date()): Promise<boolean> {
      return (await bump(userId, now)) <= MAX_WRONG_GUESSES;
    },

    /** Counts one wrong guess. The first one in a window starts it; one after the window's end starts a new one. */
    async record(userId: string, now = new Date()): Promise<void> {
      await bump(userId, now);
    },

    /** A success forgets the wrong guesses before it. */
    async clear(userId: string): Promise<void> {
      await db.delete(verification).where(eq(verification.id, keyOf(userId)));
    },
  };
}
