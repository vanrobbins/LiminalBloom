// The per-person limit on wrong current passwords, against the development database.
// It lives in Better Auth's `verification` table, so every serverless instance shares it.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { verification } from "@/db/auth-schema";

import { clearWrongGuesses, MAX_WRONG_GUESSES, recordWrongGuess, tooManyGuesses, WRONG_GUESS_WINDOW_MS } from "./password-guesses";

const made: string[] = [];
const newPerson = () => {
  const id = `test_guess_${randomUUID().slice(0, 8)}`;
  made.push(id);
  return id;
};

afterAll(async () => {
  for (const id of made) await db.delete(verification).where(like(verification.identifier, `%${id}`));
});

const rowsOf = (userId: string) => db.select().from(verification).where(like(verification.identifier, `%${userId}`));

describe("wrong-password guesses", () => {
  it("allows 5 wrong guesses, then refuses the next try", async () => {
    const who = newPerson();
    for (let i = 0; i < MAX_WRONG_GUESSES - 1; i++) {
      await recordWrongGuess(who);
      expect(await tooManyGuesses(who)).toBe(false);
    }
    await recordWrongGuess(who);
    expect(await tooManyGuesses(who)).toBe(true);
  });

  it("keeps one row per person, with the count as its value and the window's end as its expiry", async () => {
    const who = newPerson();
    const start = new Date("2026-11-12T12:00:00Z");
    await recordWrongGuess(who, start);
    await recordWrongGuess(who, new Date(start.getTime() + 60_000));
    const rows = await rowsOf(who);
    expect(rows).toHaveLength(1);
    expect(rows[0].identifier).toBe(`password-change-failures:${who}`);
    expect(rows[0].value).toBe("2");
    expect(rows[0].expiresAt.getTime()).toBe(start.getTime() + WRONG_GUESS_WINDOW_MS);
  });

  it("starts counting again once the 10 minutes are over", async () => {
    const who = newPerson();
    const start = new Date();
    for (let i = 0; i < MAX_WRONG_GUESSES; i++) await recordWrongGuess(who, start);
    expect(await tooManyGuesses(who, start)).toBe(true);
    const later = new Date(start.getTime() + WRONG_GUESS_WINDOW_MS + 1000);
    expect(await tooManyGuesses(who, later)).toBe(false);
    await recordWrongGuess(who, later);
    expect(await tooManyGuesses(who, later)).toBe(false);
    expect((await rowsOf(who))[0].value).toBe("1");
  });

  it("a successful change clears the count", async () => {
    const who = newPerson();
    for (let i = 0; i < MAX_WRONG_GUESSES; i++) await recordWrongGuess(who);
    await clearWrongGuesses(who);
    expect(await tooManyGuesses(who)).toBe(false);
    expect(await rowsOf(who)).toHaveLength(0);
  });

  it("counts each person separately", async () => {
    const [a, b] = [newPerson(), newPerson()];
    for (let i = 0; i < MAX_WRONG_GUESSES; i++) await recordWrongGuess(a);
    expect(await tooManyGuesses(a)).toBe(true);
    expect(await tooManyGuesses(b)).toBe(false);
    await recordWrongGuess(b);
    await clearWrongGuesses(b);
    expect(await tooManyGuesses(a)).toBe(true);
    expect(await db.select().from(verification).where(eq(verification.identifier, `password-change-failures:${a}`))).toHaveLength(1);
  });
});
