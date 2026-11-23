// What the two-factor server actions send to the browser, and the words for a refusal. No server
// imports, so client components and their tests use these types. The reasons are the ones in
// lib/two-factor/setup.ts and lib/admin/step-up.ts.

export type RefusalReason = "password" | "locked" | "already-on" | "failed" | "code" | "not-on" | "admin" | "required";

export const REFUSAL_TEXT: Record<RefusalReason, string> = {
  password: "That isn't your password.",
  locked: "Too many tries. Try again in a few minutes.",
  "already-on": "Two-step sign-in is already on.",
  failed: "Couldn't do that. Try again.",
  code: "That code didn't work. Try the newest one.",
  "not-on": "Two-step sign-in isn't on yet.",
  admin: "Liminal Bloom admins need two-step sign-in, so it stays on.",
  required: "Your role requires two-factor sign-in.",
};

export type Refused = { status: "refused"; message: string };

export type StartedReply = { status: "started"; otpauthUri: string; setupKey: string; qrSvg: string | null; backupCodes: string[] };
export type StartActionReply = StartedReply | Refused;
export type ConfirmActionReply = { status: "on" } | Refused;
export type CodesActionReply = { status: "codes"; backupCodes: string[] } | Refused;
export type VerifyActionReply = { status: "ok" } | Refused;
export type DisableActionReply = { status: "off" } | Refused;

export const refused = (reason: RefusalReason): Refused => ({ status: "refused", message: REFUSAL_TEXT[reason] });
