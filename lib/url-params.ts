// Entry params a link can carry into a page (/layout?zone=, /products?open=):
// read as an id or dropped, and removed from the address once the page has used them.

import { z } from "zod";

type Params = Record<string, string | string[] | undefined>;

/** The first value of `name` if it is a UUID; anything else is ignored, never an error. */
export function uuidParam(params: Params, name: string): string | undefined {
  const raw = params[name];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const parsed = z.uuid().safeParse(first);
  return parsed.success ? parsed.data : undefined;
}

/** `href` (path and query) without `name`, or null when it has no such param. */
export function withoutParam(href: string, name: string): string | null {
  const url = new URL(href, "http://x");
  if (!url.searchParams.has(name)) return null;
  url.searchParams.delete(name);
  return url.pathname + url.search + url.hash;
}
