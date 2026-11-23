// What the /sign-in/two-factor page says when Better Auth refuses a code (spec 0.7.1 8.3).
// `restart` means this sign-in is over and the person has to start again; the page then offers the link.

export type SignInRefusal = { message: string; restart: boolean };

/** `error` is the client's `{ status, code }`; the rate limiter's 429 carries no code, the account lock's does. */
export function twoFactorRefusal(error: { status?: number; code?: string }, method: "totp" | "backup"): SignInRefusal {
  if (error.code === "INVALID_TWO_FACTOR_COOKIE") return { message: "This sign-in timed out. Sign in again.", restart: true };
  if (error.code === "ACCOUNT_TEMPORARILY_LOCKED") return { message: "Too many tries. Sign in again in 15 minutes.", restart: true };
  if (error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") return { message: "Too many tries. Sign in again.", restart: true };
  if (error.status === 429) return { message: "Too many tries. Wait a few seconds, then try again.", restart: false };
  return { message: method === "backup" ? "That backup code didn't work. Each one works only once." : "That code didn't work. Try the newest one.", restart: false };
}
