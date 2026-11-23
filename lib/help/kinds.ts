// The kinds and statuses of a help request, in the words people see (spec 0.7.1 9.2). Pure, so the
// client components and the server share one list.

export const HELP_KINDS = ["account", "company_request", "broken", "other"] as const;
export type HelpKind = (typeof HELP_KINDS)[number];
export const HELP_STATUSES = ["open", "answered", "closed"] as const;
export type HelpStatus = (typeof HELP_STATUSES)[number];

export const KIND_LABEL: Record<HelpKind, string> = {
  account: "Account or access",
  broken: "Something isn't working",
  other: "Something else",
  company_request: "My company request",
};

/** What a person sees for a status: Waiting (on Liminal Bloom), Replied, Closed. */
export const STATUS_LABEL: Record<HelpStatus, string> = { open: "Waiting", answered: "Replied", closed: "Closed" };

/** What the form offers. `company_request` comes with 0.7.1b, and only for a person who has a request. */
export const ASKABLE_KINDS: readonly HelpKind[] = ["account", "broken", "other"];

export function askableKind(raw: unknown, allowed: readonly HelpKind[] = ASKABLE_KINDS): HelpKind | null {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as HelpKind) : null;
}

/** A thread id from the address bar: a uuid, or null (the column is a uuid and refuses anything else). */
export const threadId = (raw: unknown): string | null => (typeof raw === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw.toLowerCase() : null);
