// The activity page's URL parameters, read defensively: `limit` grows by 50 each "Show more", `kind` must be a
// kind the filter offers. Anything else falls back to the first 50 of everything.

import { isEventKind } from "./event-kinds";

export const PAGE_SIZE = 50;
export const MAX_LIMIT = 1000;

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function activityParams(raw: Raw): { limit: number; kind: string | undefined } {
  const n = Number(first(raw.limit));
  const limit = Number.isInteger(n) && n >= PAGE_SIZE ? Math.min(n, MAX_LIMIT) : PAGE_SIZE;
  const kind = first(raw.kind);
  return { limit, kind: isEventKind(kind) ? kind : undefined };
}

/** The address of the same list with 50 more rows. */
export function showMoreHref({ limit, kind }: { limit: number; kind: string | undefined }): string {
  const params = new URLSearchParams({ limit: String(limit + PAGE_SIZE) });
  if (kind) params.set("kind", kind);
  return `/admin/activity?${params}`;
}
