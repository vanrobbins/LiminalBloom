// What a company request may say (spec 0.7.1 5.1) and the slug an approval gives the company. Pure.

export const MIN_COMPANY_NAME = 2;
export const MAX_COMPANY_NAME = 60;

/** The name with outer space trimmed and inner runs of space made one, or null when it is not 2 to 60 characters. */
export function cleanCompanyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= MIN_COMPANY_NAME && name.length <= MAX_COMPANY_NAME ? name : null;
}

/**
 * "Acme Corp." -> "acme-corp". Accents fall away ("Café" -> "cafe"). A name with no letter or digit in it (only
 * symbols, or a script this does not transliterate) falls back to `company-` and the request's own id, so the
 * approval still has a slug and a second such name does not collide.
 */
export function slugifyCompany(name: string, requestId: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || `company-${requestId.slice(0, 8)}`;
}

export type RequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** What the requester's form says for each refusal. */
export const SEND_REFUSAL_TEXT = {
  "invalid-name": `Use ${MIN_COMPANY_NAME} to ${MAX_COMPANY_NAME} characters.`,
  pending: "You already have a request waiting. Withdraw it first to send a new one.",
  owner: "You own a company. Hand it to a corporate admin first.",
} as const;
