// The admin step-up's own limit on wrong authenticator codes (spec 0.7.1 8.3): with a session
// present Better Auth counts no tries on `verifyTOTP`, so without this a stolen session could
// guess six-digit codes without end. 5 wrong codes per 10 minutes, `two-factor-failures:<userId>`.

import "server-only";

import { guessLimit } from "@/lib/guess-limit";

const limit = guessLimit("two-factor-failures");

/** True once this admin has used up their wrong codes and the window has not ended. */
export const tooManyCodeGuesses = limit.tooMany;
/** Counts one wrong code. */
export const recordWrongCode = limit.record;
/** A right code forgets the wrong ones before it. */
export const clearWrongCodes = limit.clear;
