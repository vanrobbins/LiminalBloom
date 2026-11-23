// How long a company's and a region's names may be, and how they are cleaned (spec 0.7.1 3.2, 6.3). Apart
// from the server code so the forms on /company use the same numbers.

export const MIN_COMPANY_NAME = 2; // as a store's name
export const MAX_COMPANY_NAME = 60;
export const MAX_REGION_NAME = 40;

/** The name as it would be stored: trimmed, or null when it is too short or too long. */
export function cleanCompanyName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= MIN_COMPANY_NAME && name.length <= MAX_COMPANY_NAME ? name : null;
}

/** A region's name, trimmed, 1 to 40 characters, or null. */
export function cleanRegionName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_REGION_NAME ? name : null;
}
