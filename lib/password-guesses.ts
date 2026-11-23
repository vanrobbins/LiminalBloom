// A limit on wrong current passwords when changing a password (0.7.0 task 11 review), and when a
// password is asked for to set up two-factor or get new backup codes (0.7.1). The mechanism is in
// lib/guess-limit.ts: 5 wrong guesses per 10 minutes, kept in `verification` as
// `password-change-failures:<userId>`.

import "server-only";

import { guessLimit, MAX_WRONG_GUESSES, WRONG_GUESS_WINDOW_MS } from "./guess-limit";

export { MAX_WRONG_GUESSES, WRONG_GUESS_WINDOW_MS };

const limit = guessLimit("password-change-failures");

/** True once this person has used up their wrong guesses and the window has not ended. */
export const tooManyGuesses = limit.tooMany;
/** Counts one wrong current password. */
export const recordWrongGuess = limit.record;
/** A successful change forgets the wrong guesses before it. */
export const clearWrongGuesses = limit.clear;
