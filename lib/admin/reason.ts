// The reason an admin gives for a help action (spec 0.7.1 7.4): required, 5 to 500 characters, shown in the log.
// Pure, so the dialog and every server action apply the same rule.

export const MIN_REASON = 5;
export const MAX_REASON = 500;

/** The trimmed reason, or null when it is not text or not 5 to 500 characters. */
export function cleanReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const reason = raw.trim();
  return reason.length >= MIN_REASON && reason.length <= MAX_REASON ? reason : null;
}
