// What the passkey server actions send to the browser, and the words for a refusal. No server imports,
// so client components and their tests use these types.

export type PasskeyRefusal = "password" | "code" | "locked" | "missing" | "name" | "last" | "verify" | "failed";

export const PASSKEY_REFUSAL_TEXT: Record<PasskeyRefusal, string> = {
  password: "That isn't your password.",
  code: "That code isn't right. Enter a current code from your authenticator app.",
  locked: "Too many tries. Try again in a few minutes.",
  missing: "That passkey isn't there any more.",
  name: "Give it a name of 1 to 60 characters.",
  last: "This is your only passkey, and you need it to sign in with two steps.",
  verify: "Confirm it's you first: use your authenticator app or a passkey at /admin/verify, then come back.",
  failed: "Couldn't do that. Try again.",
};

export type PasskeyReply = { status: "ok" } | { status: "refused"; message: string };

export const passkeyRefused = (reason: PasskeyRefusal, store?: string): PasskeyReply => ({
  status: "refused",
  message: reason === "last" && store ? `Your role in ${store} requires two-factor sign-in, and this is your only passkey.` : PASSKEY_REFUSAL_TEXT[reason],
});
