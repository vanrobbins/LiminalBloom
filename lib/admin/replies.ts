// What an admin server action answers and what the dialog says for each refusal (spec 0.7.1 7.4, 12). Pure:
// the actions return only a status (no ids or rows cross), and the words live here so every dialog says the
// same thing. `final` means the dialog's picture is out of date for good: its confirm turns off and closing
// it reloads the page.

import type { AdminActor } from "./events";

export type ReplyStatus = "done" | "forbidden" | "invalid-reason" | "invalid" | "gone" | "already" | "admin" | "not-on" | "last" | "no-account";
export type AdminReply = { status: ReplyStatus };

export const REPLY_TEXT: Record<Exclude<ReplyStatus, "done">, { message: string; final: boolean }> = {
  forbidden: { message: "Your admin access needs a fresh check. Reload the page and verify again.", final: true },
  "invalid-reason": { message: "Give a reason of 5 to 500 characters.", final: false },
  invalid: { message: "That can't be done. Close and look again.", final: true },
  gone: { message: "That isn't there anymore. Close and look again.", final: true },
  already: { message: "That has already changed. Close and look again.", final: true },
  admin: { message: "A Liminal Bloom admin's two-step sign-in can only be reset with the script.", final: true },
  "not-on": { message: "They don't have two-step sign-in on.", final: true },
  last: { message: "That's the last admin. Add another first.", final: false },
  "no-account": { message: "No account has that email. They need to sign up first.", final: false },
};

/** The refusal's text for a dialog, with the action's own wording where it has one. */
export function replyText(status: Exclude<ReplyStatus, "done">, own: Partial<Record<ReplyStatus, string>> = {}): { message: string; final: boolean } {
  const base = REPLY_TEXT[status];
  return { message: own[status] ?? base.message, final: base.final };
}

/** What crosses to the browser: the status and nothing else (no email, name or count the library returned). */
export const replyOf = (outcome: { status: ReplyStatus }): AdminReply => ({ status: outcome.status });

/** The actor an action passes to lib/admin: the admin its guard returned. */
export const actorOf = (admin: { userId: string; name: string }): AdminActor => ({ userId: admin.userId, name: admin.name });

/** An id from the browser: non-empty text of a sane length, or null. */
export const idOf = (raw: unknown): string | null => (typeof raw === "string" && raw !== "" && raw.length <= 200 ? raw : null);
