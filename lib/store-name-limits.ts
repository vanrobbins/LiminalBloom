// How long a store's name may be, and how it is cleaned. Apart from lib/store-name.ts
// (server only) so the form on Store settings can use the same numbers.

export const MIN_STORE_NAME = 2; // the same floor as store creation (app/create-store/actions.ts)
export const MAX_STORE_NAME = 60;

/** The name as it would be stored: trimmed, or null when it is too short or too long. */
export function cleanStoreName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= MIN_STORE_NAME && name.length <= MAX_STORE_NAME ? name : null;
}
