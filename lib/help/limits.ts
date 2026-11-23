// What a help request may hold (spec 0.7.1 9.2; DECISIONS 11-23): 5 open per person, 50 messages per request,
// 10 to 2000 characters to open one and 1 to 2000 for a reply. Bodies are plain text. Pure.

export const MAX_OPEN_REQUESTS = 5;
export const MAX_MESSAGES = 50;
export const MIN_FIRST_BODY = 10;
export const MIN_REPLY_BODY = 1;
export const MAX_BODY = 2000;

/** The trimmed text, or null when it is not text or not within `min` to 2000 characters. */
export function cleanBody(raw: unknown, min: number): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  return body.length >= min && body.length <= MAX_BODY ? body : null;
}

export type HelpRefusal = "invalid-kind" | "invalid-body" | "too-many-open" | "already-open" | "too-many-messages" | "closed" | "gone";
export type HelpOutcome = { status: "done"; id?: string } | { status: HelpRefusal };

/** What the form says under the field for each refusal. */
export const REFUSAL_TEXT: Record<HelpRefusal, string> = {
  "invalid-kind": "Pick what this is about.",
  "invalid-body": `Write ${MIN_FIRST_BODY} to ${MAX_BODY} characters.`,
  "too-many-open": `You already have ${MAX_OPEN_REQUESTS} open requests. Close one you no longer need, then try again.`,
  "already-open": "You already have a conversation open about this request. Reply there.",
  "too-many-messages": "This thread is full. Close it and ask again in a new request.",
  closed: "This request is closed. Ask again if you still need help.",
  gone: "That request isn't there anymore.",
};
