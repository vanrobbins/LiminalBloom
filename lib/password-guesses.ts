// A limit on wrong current passwords when changing a password (0.7.0 task 11 review).
// `auth.api.changePassword` called from the server action skips Better Auth's HTTP rate
// limiter, so a stolen session or an unlocked shared tablet could guess the current
// password without any throttle. After MAX_WRONG_GUESSES wrong ones inside the window the
// action refuses without asking Better Auth.
//
// The count is shared by every serverless instance, so it is a row in Better Auth's own
// `verification` table: identifier `password-change-failures:<userId>`, value = the count,
// expiresAt = the window's end. The row's id is the same string, so one statement
// (insert, or on conflict add one) is atomic: the HTTP driver has no transactions.

import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/auth-schema";

export const MAX_WRONG_GUESSES = 5;
export const WRONG_GUESS_WINDOW_MS = 10 * 60_000;

const keyOf = (userId: string) => `password-change-failures:${userId}`;

/** True once this person has used up their wrong guesses and the window has not ended. */
export async function tooManyGuesses(userId: string, now = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ value: verification.value })
    .from(verification)
    .where(and(eq(verification.id, keyOf(userId)), gt(verification.expiresAt, now)));
  return row !== undefined && Number(row.value) >= MAX_WRONG_GUESSES;
}

/** Counts one wrong current password. The first one in a window starts it; one after the window's end starts a new one. */
export async function recordWrongGuess(userId: string, now = new Date()): Promise<void> {
  const key = keyOf(userId);
  const end = new Date(now.getTime() + WRONG_GUESS_WINDOW_MS);
  // ISO strings cast to timestamp: the column holds UTC without a zone, as Drizzle writes it.
  const over = sql`${verification.expiresAt} <= ${now.toISOString()}::timestamp`;
  await db
    .insert(verification)
    .values({ id: key, identifier: key, value: "1", expiresAt: end })
    .onConflictDoUpdate({
      target: verification.id,
      set: {
        value: sql`case when ${over} then '1' else (${verification.value}::int + 1)::text end`,
        expiresAt: sql`case when ${over} then ${end.toISOString()}::timestamp else ${verification.expiresAt} end`,
      },
    });
}

/** A successful change forgets the wrong guesses before it. */
export async function clearWrongGuesses(userId: string): Promise<void> {
  await db.delete(verification).where(eq(verification.id, keyOf(userId)));
}
