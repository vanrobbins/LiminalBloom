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

/** `href` (path and query) without the named params, or null when it has none of them. */
export function withoutParam(href: string, ...names: string[]): string | null {
  const url = new URL(href, "http://x");
  if (!names.some((name) => url.searchParams.has(name))) return null;
  for (const name of names) url.searchParams.delete(name);
  return url.pathname + url.search + url.hash;
}

// A link that opens a screen on something (/layout?zone=, /products?open=) carries `n`, which
// nothing reads except the page's remount key. The screens drop their param once used, so the
// same pick made twice would otherwise be the same props and change nothing.
const ENTRY = /[?&](zone|open)=/;

/** `href` with a fresh `n` when it is an entry link; any other link is returned as it was. */
export function withNonce(href: string, nonce: string = Date.now().toString(36)): string {
  return ENTRY.test(href) ? `${href}&n=${nonce}` : href;
}

/** The `n` of an entry link, or "" (a short plain token only: it goes into a React key). */
export function nonceParam(params: Params): string {
  const raw = params.n;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first !== undefined && /^[a-z0-9]{1,12}$/i.test(first) ? first : "";
}
